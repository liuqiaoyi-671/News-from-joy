'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import MarketCard from '@/components/MarketCard'
import SectorWatchPanel from '@/components/SectorWatchPanel'
import DetailModal from '@/components/DetailModal'
import MarketLineChart from '@/components/MarketLineChart'

// ── 类型 ──────────────────────────────────────────────────────────────────────
interface DayData { date: string; close: number; pct_chg: number }
interface MarketItem {
  id: string; name: string; price: number; change: number; pct_chg: number
  ma20: number | null; history: DayData[]; unit?: string; description?: string
}
interface SectorBadge {
  id: string; name: string; score: number; label: string; newsCount: number; summary: string
  status?: 'ok' | 'unavailable' | 'insufficient_data'
}
interface DigestItem {
  headline: string; body: string; sectors: string[]; sentiment: 'positive' | 'negative' | 'neutral'
}
interface DigestResult {
  items: DigestItem[]; generatedAt: string; source: 'ai' | 'unavailable'
}
interface NewsItem {
  title: string; url: string; source: string; pubDate: string
  sectors: string[]; lang: 'zh' | 'en'
}

// ── 工具 ──────────────────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 30)  return 'text-up'
  if (score <= -30) return 'text-down'
  return 'text-gray-400'
}

// ── 页面 ──────────────────────────────────────────────────────────────────────
export default function MarketPage() {
  const [cnData,        setCnData]        = useState<MarketItem[]>([])
  const [usData,        setUsData]        = useState<MarketItem[]>([])
  const [sentiments,    setSentiments]    = useState<SectorBadge[]>([])
  const [digest,        setDigest]        = useState<DigestResult | null>(null)
  const [digestLoading, setDigestLoading] = useState(true)
  const [news,          setNews]          = useState<NewsItem[]>([])
  const [newsLoading,   setNewsLoading]   = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [sentLoading,   setSentLoading]   = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [updatedAt,     setUpdatedAt]     = useState('')
  const [selected,      setSelected]      = useState<MarketItem | null>(null)
  const [chartItem,     setChartItem]     = useState<MarketItem | null>(null)
  const [trackedSectors, setTrackedSectors] = useState<string[]>([])
  const trackedRef = useRef<string[]>([])

  // ── 行情数据 ───────────────────────────────────────────────────────────────
  const fetchMarket = useCallback(async (fresh = false) => {
    const qs = fresh ? '?fresh=1' : ''
    try {
      const [cnRes, usRes] = await Promise.all([
        fetch(`/api/market/cn${qs}`).then(r => r.json()),
        fetch(`/api/market/us${qs}`).then(r => r.json()),
      ])
      setCnData(cnRes.data  || [])
      setUsData(usRes.data  || [])
      setUpdatedAt(cnRes.updatedAt || '')
    } catch { /* 网络错误：保留上次数据 */ }
    setLoading(false)
    setRefreshing(false)
  }, [])

  // ── 今日要点 AI 摘要 ───────────────────────────────────────────────────────
  const fetchDigest = useCallback(async (fresh = false) => {
    setDigestLoading(true)
    try {
      const secs = trackedRef.current
      const qs = fresh ? '&fresh=1' : ''
      const url = secs.length > 0
        ? `/api/market/digest?sectors=${secs.slice(0, 5).join(',')}${qs}`
        : `/api/market/digest${fresh ? '?fresh=1' : ''}`
      const res = await fetch(url).then(r => r.json())
      setDigest(res)
    } catch {}
    setDigestLoading(false)
  }, [])

  // ── 情绪板块（独立加载） ────────────────────────────────────────────────────
  const fetchSentiment = useCallback(async () => {
    setSentLoading(true)
    try {
      const res = await fetch('/api/sentiment').then(r => r.json())
      const sectors: SectorBadge[] = (res.sectors || [])
        .filter((s: SectorBadge) => s.newsCount > 0 && s.status !== 'unavailable')
        .sort((a: SectorBadge, b: SectorBadge) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 8)
      setSentiments(sectors)
    } catch {}
    setSentLoading(false)
  }, [])

  // ── 资讯精选（按 trackedSectors 过滤） ────────────────────────────────────
  const fetchNews = useCallback(async (sectors: string[]) => {
    setNewsLoading(true)
    try {
      const sector = sectors.length === 1 ? sectors[0] : 'all'
      const res = await fetch(`/api/news?sector=${sector}&noai=1`, { cache: 'no-store' }).then(r => r.json())
      let items: NewsItem[] = res.articles || []
      if (sectors.length > 1) {
        items = items.filter((a: NewsItem) => a.sectors.some(s => sectors.includes(s)))
      }
      const cutoff = Date.now() - 3 * 60 * 60 * 1000
      items = items
        .filter((a: NewsItem) => new Date(a.pubDate || 0).getTime() > cutoff)
        .slice(0, 12)
      setNews(items)
    } catch {}
    setNewsLoading(false)
  }, [])

  useEffect(() => {
    fetchMarket(); fetchSentiment(); fetchDigest()
  }, [fetchMarket, fetchSentiment, fetchDigest])

  // ── trackedSectors 变化时刷新新闻 & digest ─────────────────────────────────
  const handleSectorsChange = useCallback((sectors: string[]) => {
    trackedRef.current = sectors
    setTrackedSectors(sectors)
    fetchNews(sectors)
  }, [fetchNews])

  // ── 刷新 ───────────────────────────────────────────────────────────────────
  function handleRefresh() {
    setRefreshing(true)
    fetchMarket(true)
    fetchDigest(true)
    fetchNews(trackedRef.current)
  }

  // ── 点击卡片 → 更新走势图 ──────────────────────────────────────────────────
  function openCard(item: MarketItem) {
    setChartItem(item)
    setSelected(item)
  }

  // 默认图：沪深300
  const defaultChart = cnData.find(d => d.id === 'csi300') || cnData[0] || null
  const displayChart = chartItem || defaultChart

  return (
    <div className="min-h-screen bg-bg-primary">
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* ── 标题行 ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-100">市场总览</h1>
            {updatedAt && (
              <p className="text-[11px] text-gray-600 mt-0.5">
                数据更新于 {new Date(updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                <span className="ml-2 text-gray-700">· 延迟约 15 分钟</span>
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '刷新中' : '刷新行情'}
          </button>
        </div>

        {/* ── 今日要点 ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              ✨ 今日要点
            </h2>
            {digest && !digestLoading && (
              <span className="text-[11px] text-gray-600">
                {trackedSectors.length > 0 ? '基于你的关注板块' : '全市场'}
                · {new Date(digest.generatedAt).toLocaleTimeString('zh-CN', {
                  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit'
                })} 生成
              </span>
            )}
          </div>
          {digestLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-600 py-3">
              <Loader2 size={12} className="animate-spin" /> AI 正在提炼今日要点…
            </div>
          ) : digest?.items && digest.items.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {digest.items.map((item, i) => {
                const Icon = item.sentiment === 'positive' ? TrendingUp
                  : item.sentiment === 'negative' ? TrendingDown : Minus
                const color = item.sentiment === 'positive' ? 'text-up border-up/20 bg-up/5'
                  : item.sentiment === 'negative' ? 'text-down border-down/20 bg-down/5'
                  : 'text-gray-400 border-border bg-bg-card'
                const iconColor = item.sentiment === 'positive' ? 'text-up'
                  : item.sentiment === 'negative' ? 'text-down' : 'text-gray-500'
                return (
                  <div key={i} className={`border rounded-xl p-4 ${color}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <Icon size={14} className={`${iconColor} flex-shrink-0 mt-0.5`} />
                      <p className="text-sm font-semibold text-gray-100 leading-snug">{item.headline}</p>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-xs text-gray-600 bg-bg-card border border-border rounded-xl px-4 py-3">
              {digest?.source === 'unavailable'
                ? '暂无 AI 摘要（未配置 DeepSeek API Key）'
                : '近期暂无足够资讯生成要点，稍后再试'}
            </div>
          )}
        </section>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-gray-500">
            <Loader2 size={18} className="animate-spin" /><span>加载行情中…</span>
          </div>
        ) : (<>

          {/* ── A股指数 ──────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
              🇨🇳 A股指数
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {cnData.map(item => (
                <MarketCard key={item.id} {...item} onClick={() => openCard(item)} />
              ))}
            </div>
          </section>

          {/* ── 国际 · 宏观 ──────────────────────────────────────────────── */}
          <section>
            <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
              🌍 国际 · 宏观
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {usData.map(item => (
                <MarketCard key={item.id} {...item} onClick={() => openCard(item)} />
              ))}
            </div>
          </section>

          {/* ── 走势图（recharts，点击卡片切换）──────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                📈 走势图
              </h2>
              <p className="text-[11px] text-gray-600">点击上方卡片切换标的</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
              {displayChart ? (
                <MarketLineChart
                  key={displayChart.id}
                  data={displayChart.history || []}
                  name={displayChart.name}
                  unit={displayChart.unit}
                  height={400}
                />
              ) : (
                <div className="flex items-center justify-center h-[400px] text-gray-600 text-sm">
                  加载中…
                </div>
              )}
            </div>
          </section>

          {/* ── 板块情绪 ─────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                🧭 板块情绪
              </h2>
              <a href="/sentiment" className="text-[11px] text-accent hover:underline">
                查看完整雷达 →
              </a>
            </div>
            {sentLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-600 py-4">
                <Loader2 size={12} className="animate-spin" />AI 分析情绪中…
              </div>
            ) : sentiments.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {sentiments.map(s => (
                  <a key={s.id} href="/sentiment"
                    className="bg-bg-card border border-border rounded-xl p-3 hover:border-gray-600 transition-colors group"
                    title={s.summary}
                  >
                    <div className="text-[10px] text-gray-500 mb-1.5 truncate">{s.name}</div>
                    <div className={`text-base font-bold font-mono leading-none ${scoreColor(s.score)}`}>
                      {s.score >= 0 ? '+' : ''}{s.score}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">{s.newsCount} 条</div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600 py-2">暂无情绪数据，请稍后重试</p>
            )}
          </section>

          {/* ── 最新资讯 ─────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                📰 最新资讯
                {trackedSectors.length > 0 && (
                  <span className="ml-1 text-gray-600 normal-case font-normal">· 基于关注板块</span>
                )}
              </h2>
              <a href="/news" className="text-[11px] text-accent hover:underline">全部资讯 →</a>
            </div>
            {newsLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-600 py-3">
                <Loader2 size={12} className="animate-spin" />加载资讯中…
              </div>
            ) : news.length > 0 ? (
              <div className="space-y-1">
                {news.map((n, i) => (
                  <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-bg-card border border-transparent hover:border-border transition-colors group"
                  >
                    <span className="text-[10px] text-gray-600 whitespace-nowrap mt-0.5 flex-shrink-0">{n.source}</span>
                    <span className="text-sm text-gray-300 group-hover:text-gray-100 leading-snug line-clamp-2">{n.title}</span>
                    <span className="text-[10px] text-gray-700 whitespace-nowrap ml-auto flex-shrink-0 mt-0.5">
                      {(() => {
                        const diff = Date.now() - new Date(n.pubDate || 0).getTime()
                        const h = Math.floor(diff / 3600000)
                        const m = Math.floor(diff / 60000)
                        return h > 0 ? `${h}h前` : `${Math.max(m, 1)}m前`
                      })()}
                    </span>
                  </a>
                ))}
              </div>
            ) : trackedSectors.length === 0 ? (
              <p className="text-xs text-gray-600 py-2">从下方"行业看板"选择关注板块，这里会显示相关资讯</p>
            ) : (
              <p className="text-xs text-gray-600 py-2">近 3 小时暂无相关资讯</p>
            )}
          </section>

          {/* ── 行业看板（专业指标面板） ─────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              ⭐ 行业看板
            </h2>
            <SectorWatchPanel onSectorsChange={handleSectorsChange} />
          </section>

        </>)}
      </main>

      {/* ── 详情弹窗 ─────────────────────────────────────────────────────── */}
      <DetailModal
        item={selected}
        onClose={() => setSelected(null)}
        inWatchlist={false}
        onWatchlist={() => {}}
      />
    </div>
  )
}
