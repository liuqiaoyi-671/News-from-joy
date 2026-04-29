'use client'
import { useEffect, useState, useRef } from 'react'
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'
import SentimentHistoryChart, { type SentimentSnapshot } from '@/components/SentimentHistoryChart'

interface SectorSentiment {
  id: string
  name: string
  newsCount: number
  score: number
  label: string
  confidence: string
  summary: string
  drivers: string[]
  topNews: { title: string; url: string; source: string; pubDate: string }[]
}

// ── localStorage 缓存（2h 过期，情绪分析变化慢） ──────────────────────────────
const CACHE_KEY = 'sentiment-cache-v1'
const CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000

function readCache(): { data: SectorSentiment[]; generatedAt: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, generatedAt, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_MAX_AGE_MS) return null
    return { data, generatedAt }
  } catch { return null }
}

function writeCache(data: SectorSentiment[], generatedAt: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, generatedAt, ts: Date.now() }))
  } catch { /* storage full */ }
}

// ── 历史快照（每天一条，最多 14 天）─────────────────────────────────────────────
const HISTORY_KEY = 'sentiment-history-v1'
const MAX_HISTORY_DAYS = 14

function saveSnapshot(data: SectorSentiment[]) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw = localStorage.getItem(HISTORY_KEY)
    const history: SentimentSnapshot[] = raw ? JSON.parse(raw) : []
    const filtered = history.filter(h => h.date !== today)
    filtered.push({
      date: today,
      ts: Date.now(),
      sectors: data.map(s => ({ id: s.id, name: s.name, score: s.score })),
    })
    filtered.sort((a, b) => a.date.localeCompare(b.date))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(-MAX_HISTORY_DAYS)))
  } catch { /* storage full */ }
}

function loadHistory(): SentimentSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// ── 颜色（A股：红=看多，绿=看空） ─────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 60)  return { bg: '#3a0d0d', text: '#fca5a5', border: '#dc2626' }
  if (score >= 20)  return { bg: '#2a1414', text: '#fca5a5', border: '#ef4444' }
  if (score > -20)  return { bg: '#1f1f1f', text: '#9ca3af', border: '#4b5563' }
  if (score > -60)  return { bg: '#0d2517', text: '#86efac', border: '#22c55e' }
  return              { bg: '#0d2f1f', text: '#34d399', border: '#10b981' }
}

function ScoreIcon({ score }: { score: number }) {
  if (score >= 20)  return <TrendingUp size={18} />
  if (score <= -20) return <TrendingDown size={18} />
  return <Minus size={18} />
}

function ConfidenceBadge({ c }: { c: string }) {
  const map: Record<string, { label: string; color: string }> = {
    high: { label: '高置信', color: '#3b82f6' },
    med:  { label: '中置信', color: '#a855f7' },
    low:  { label: '低置信', color: '#6b7280' },
  }
  const v = map[c] || map.low
  return (
    <span style={{ background: `${v.color}22`, color: v.color, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {v.label}
    </span>
  )
}

export default function SentimentPage() {
  const [data, setData] = useState<SectorSentiment[]>([])
  const [generatedAt, setGeneratedAt] = useState('')
  const [loading, setLoading]       = useState(false)    // 首次无缓存时的全屏 spinner
  const [refreshing, setRefreshing] = useState(false)    // 有缓存时后台刷新指示
  const [error, setError]           = useState<string | null>(null)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [tab, setTab]               = useState<'current' | 'history'>('current')
  const [history, setHistory]       = useState<SentimentSnapshot[]>([])
  const fetchId = useRef(0)

  async function load(forceRefresh = false) {
    const id = ++fetchId.current

    // 1. 先读本地缓存立刻渲染
    if (!forceRefresh) {
      const cached = readCache()
      if (cached) {
        setData(cached.data)
        setGeneratedAt(cached.generatedAt)
        setLoading(false)
        setRefreshing(true)
      } else {
        setLoading(true)
      }
    } else {
      setLoading(data.length === 0)
      setRefreshing(data.length > 0)
    }
    setError(null)

    // 2. 后台请求最新数据
    const sources = ['/api/sentiment', './sentiment-data.json', '/sentiment-data.json']
    let lastErr: unknown
    for (const url of sources) {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) { lastErr = new Error(`${url}: ${res.status}`); continue }
        const j = await res.json()
        if (j.error) { lastErr = new Error(j.error); continue }
        if (fetchId.current !== id) return  // 被更新请求取代
        const freshData: SectorSentiment[] = j.sectors || []
        const freshAt: string = j.generatedAt || ''
        setData(freshData)
        setGeneratedAt(freshAt)
        setError(null)
        writeCache(freshData, freshAt)
        saveSnapshot(freshData)
        setHistory(loadHistory())
        setLoading(false); setRefreshing(false)
        return
      } catch (e) { lastErr = e }
    }
    if (fetchId.current === id) {
      setError(String(lastErr))
      setLoading(false); setRefreshing(false)
    }
  }

  // 仅重试失败板块
  async function retryFailed() {
    const failed = data.filter(s => s.summary.includes('失败') || s.summary.includes('解析'))
    if (!failed.length) return
    setRefreshing(true)
    try {
      const updated = [...data]
      for (const f of failed) {
        try {
          const res = await fetch(`/api/sentiment?sector=${f.id}`)
          const j = await res.json()
          if (j.sector) {
            const idx = updated.findIndex(d => d.id === f.id)
            if (idx >= 0) updated[idx] = j.sector
          }
        } catch { /* skip */ }
      }
      updated.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      setData(updated)
      writeCache(updated, new Date().toISOString())
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => { setHistory(loadHistory()); load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const stats = data.length ? {
    avgScore: Math.round(data.reduce((s, d) => s + d.score, 0) / data.length),
    bullish:  data.filter(d => d.score >= 20).length,
    bearish:  data.filter(d => d.score <= -20).length,
    neutral:  data.filter(d => Math.abs(d.score) < 20).length,
  } : null

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* 顶栏 */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>📊 板块情绪雷达</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
              AI 基于 24h 内资讯实时打分 · -100 看空 ~ +100 看多
              {generatedAt && ` · 更新于 ${new Date(generatedAt).toLocaleTimeString('zh-CN')}`}
              {refreshing && (
                <Loader2 size={11} className="animate-spin" style={{ color: '#4b5563' }} />
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {data.some(s => s.summary.includes('失败')) && (
              <button
                onClick={retryFailed}
                disabled={refreshing}
                style={{ background: '#a855f7', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                ⟲ 重试失败板块
              </button>
            )}
            <a href="/news" style={{ color: '#3b82f6', fontSize: 13, padding: '8px 12px', textDecoration: 'none', border: '1px solid #2a2a2a', borderRadius: 6 }}>
              查看资讯流
            </a>
            <button
              onClick={() => load(true)}
              disabled={loading || refreshing}
              style={{
                background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px',
                borderRadius: 6, cursor: (loading || refreshing) ? 'wait' : 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6, opacity: (loading || refreshing) ? 0.7 : 1,
              }}
            >
              <RefreshCw size={14} className={(loading || refreshing) ? 'animate-spin' : ''} />
              {refreshing ? '刷新中…' : loading ? '分析中…' : '刷新'}
            </button>
          </div>
        </header>

        {/* 全局统计 */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard label="市场整体均值" value={`${stats.avgScore > 0 ? '+' : ''}${stats.avgScore}`} color={scoreColor(stats.avgScore).text} />
            <StatCard label="看多板块" value={String(stats.bullish)} color="#fca5a5" suffix="个" />
            <StatCard label="看空板块" value={String(stats.bearish)} color="#86efac" suffix="个" />
            <StatCard label="中性板块" value={String(stats.neutral)} color="#9ca3af" suffix="个" />
          </div>
        )}

        {/* 视图切换 */}
        <div style={{ display: 'flex', gap: 4, background: '#111', borderRadius: 8, padding: 4, marginBottom: 16, width: 'fit-content' }}>
          {(['current', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: 'none',
                background: tab === t ? '#3b82f6' : 'transparent',
                color: tab === t ? 'white' : '#6b7280',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {t === 'current' ? '当前快照' : (
                <>历史趋势{history.length > 0 && <span style={{ fontSize: 10, background: '#1f2937', padding: '1px 5px', borderRadius: 3, color: '#9ca3af' }}>{history.length}天</span>}</>
              )}
            </button>
          ))}
        </div>

        {/* 首次加载 spinner */}
        {loading && data.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} />
            <p>首次分析约需 30–60 秒（19 个板块批量分析）…</p>
          </div>
        )}

        {error && (
          <div style={{ padding: 16, background: '#3a0d0d', border: '1px solid #dc2626', borderRadius: 8, color: '#fca5a5', marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* 历史趋势图 */}
        {tab === 'history' && (
          <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 10, padding: 20 }}>
            <SentimentHistoryChart snapshots={history} />
          </div>
        )}

        {/* 板块卡片网格 */}
        {tab === 'current' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {data.map(s => {
            const c = scoreColor(s.score)
            const isOpen = expanded === s.id
            return (
              <div
                key={s.id}
                onClick={() => setExpanded(isOpen ? null : s.id)}
                style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: 16, cursor: 'pointer', transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {/* 头部 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: c.text }}><ScoreIcon score={s.score} /></span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 800, color: c.text }}>
                    {s.score > 0 ? '+' : ''}{s.score}
                  </span>
                </div>

                {/* 标签行 */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: `${c.border}33`, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                    {s.label}
                  </span>
                  <ConfidenceBadge c={s.confidence} />
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{s.newsCount} 条资讯</span>
                </div>

                {/* 摘要 */}
                <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: '#d1d5db' }}>{s.summary}</p>

                {/* 评分条 */}
                <div style={{ height: 6, background: '#1f1f1f', borderRadius: 3, overflow: 'hidden', marginBottom: 10, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#4b5563', zIndex: 1 }} />
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    [s.score >= 0 ? 'left' : 'right']: '50%',
                    width: `${Math.abs(s.score) / 2}%`,
                    background: c.text, transition: 'width 0.3s',
                  }} />
                </div>

                {/* 驱动因素 */}
                {s.drivers.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {s.drivers.map((d, i) => (
                      <span key={i} style={{ background: '#1f1f1f', color: '#9ca3af', padding: '3px 8px', borderRadius: 4, fontSize: 11, border: '1px solid #2a2a2a' }}>
                        {d}
                      </span>
                    ))}
                  </div>
                )}

                {/* 展开：核心资讯 */}
                {isOpen && s.topNews.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #2a2a2a' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>核心资讯：</div>
                    {s.topNews.map((n, i) => (
                      <a
                        key={i}
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'block', padding: '6px 0', fontSize: 12,
                          color: '#9ca3af', textDecoration: 'none',
                          borderBottom: i < s.topNews.length - 1 ? '1px solid #1f1f1f' : 'none',
                        }}
                      >
                        <ExternalLink size={10} style={{ display: 'inline', marginRight: 4, opacity: 0.6 }} />
                        {n.title}
                        <span style={{ color: '#4b5563', marginLeft: 6 }}>· {n.source}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>}

        <p style={{ textAlign: 'center', color: '#4b5563', fontSize: 11, marginTop: 32 }}>
          {tab === 'current' ? '点击卡片展开核心资讯 · ' : ''}AI 内容仅供参考，不构成投资建议
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function StatCard({ label, value, color, suffix }: { label: string; value: string; color: string; suffix?: string }) {
  return (
    <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>
        {value}{suffix && <span style={{ fontSize: 13, marginLeft: 2, color: '#6b7280' }}>{suffix}</span>}
      </div>
    </div>
  )
}
