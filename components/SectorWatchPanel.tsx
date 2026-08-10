'use client'
import { useEffect, useState, useCallback } from 'react'
import { Loader2, X, Plus, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react'

// ─── 每个板块的研究员核心关注指标（基本面 + 宏观）────────────────────────────
// desc 说明该板块关注的核心基本面维度
export const SECTOR_KPI: Record<string, { label: string; desc: string; ids: string[] }> = {
  macro:        { label: '宏观/政策',   desc: 'CPI·PPI·PMI·M2·社零',      ids: [] },
  finance:      { label: '金融',        desc: 'M2·社融·信贷·LPR',           ids: [] },
  realestate:   { label: '房地产/建筑', desc: '70城房价·投资·销售·库存',    ids: [] },
  energy:       { label: '能源/煤炭',   desc: '动力煤·燃料油·发电量',       ids: [] },
  newenergy:    { label: '新能源',       desc: '碳酸锂·铜·装机量·产销',      ids: [] },
  agriculture:  { label: '农林牧渔',    desc: '豆粕·玉米·豆油·鸡蛋',       ids: [] },
  food:         { label: '食品饮料',    desc: 'CPI·社零·白酒·上游原料',     ids: [] },
  chemicals:    { label: '化工',        desc: 'PTA·甲醇·乙二醇·原油',       ids: [] },
  metals:       { label: '钢铁/有色',   desc: '铜·铝·锌·镍·螺纹钢',        ids: [] },
  pharma:       { label: '医药生物',    desc: '医保·创新药·带量采购·CPI',   ids: [] },
  ai:           { label: 'AI & 科技',   desc: 'GPU·算力需求·云收入·PMI',    ids: [] },
  semiconductor:{ label: '半导体/电子', desc: 'PMI·半导体景气·外贸',        ids: [] },
  auto:         { label: '汽车',        desc: '产销量·锂价·铜价·新能源渗透', ids: [] },
  consumer:     { label: '消费/零售',   desc: '社零·CPI·居民收入·出行',     ids: [] },
  defense:      { label: '军工/航天',   desc: '国防预算·PMI·工增',          ids: [] },
  telecom:      { label: '通信',        desc: 'PMI·流量·基站投资',          ids: [] },
  environment:  { label: '环保/公用',   desc: '电价·天然气·环保投资',       ids: [] },
  transport:    { label: '交通运输',    desc: '货运量·原油·运价·社零',      ids: [] },
}

const ALL_SECTORS = Object.keys(SECTOR_KPI)

const SECTOR_ICONS: Record<string, string> = {
  macro: '🌐', finance: '🏦', realestate: '🏗', energy: '⛽', newenergy: '⚡',
  agriculture: '🌾', food: '🍾', chemicals: '🧪', metals: '⚙️', pharma: '💊',
  ai: '🤖', semiconductor: '💾', auto: '🚗', consumer: '🛍', defense: '🛡',
  telecom: '📡', environment: '🌱', transport: '🚢',
}

interface MacroPoint { period: string; value: number }
interface MacroIndicator {
  id: string; name: string; unit: string
  latest: number; period: string
  mom: number | null; yoy: number | null
  history: MacroPoint[]
  direction: 'up' | 'down' | 'flat'
}
interface SectorData {
  indicators: MacroIndicator[]
  commentary: string
  updatedAt: string
}

interface Props {
  onSectorsChange?: (sectors: string[]) => void
}

const STORAGE_KEY = 'tracked-sectors-v2'

// ── 迷你趋势 sparkline ───────────────────────────────────────────────────────
function Sparkline({ history, color }: { history: MacroPoint[]; color: string }) {
  if (history.length < 2) return null
  const vals = history.map(h => h.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const W = 60, H = 24
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── 单个指标卡片 ─────────────────────────────────────────────────────────────
function IndicatorCard({ ind }: { ind: MacroIndicator }) {
  const isUp   = ind.direction === 'up'
  const isDown = ind.direction === 'down'
  const color  = isUp ? '#ef4444' : isDown ? '#22c55e' : '#6b7280'

  const fmt = (n: number) => {
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '万'
    if (Math.abs(n) >= 1000)  return (n / 1000).toFixed(1) + 'k'
    if (Math.abs(n) < 0.1 && n !== 0) return n.toFixed(3)
    return n.toFixed(2)
  }

  return (
    <div style={{
      background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 10,
      padding: '10px 12px', flex: '1 1 110px', minWidth: 110,
    }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {ind.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 6 }}>
        <span style={{ fontSize: 17, fontWeight: 700, fontFamily: 'monospace', color }}>
          {fmt(ind.latest)}
        </span>
        {ind.unit && <span style={{ fontSize: 10, color: '#6b7280' }}>{ind.unit}</span>}
      </div>
      <Sparkline history={ind.history} color={color} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
        <span style={{ fontSize: 9, color: '#374151' }}>{ind.period}</span>
        {ind.mom !== null && (
          <span style={{ fontSize: 9, color, fontFamily: 'monospace' }}>
            {ind.mom > 0 ? '+' : ''}{ind.mom}{ind.unit}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
        {isUp   && <TrendingUp  size={9} color={color} />}
        {isDown && <TrendingDown size={9} color={color} />}
        {!isUp && !isDown && <Minus size={9} color={color} />}
        <span style={{ fontSize: 9, color }}>
          {isUp ? '上行' : isDown ? '下行' : '平稳'}
        </span>
      </div>
    </div>
  )
}

export default function SectorWatchPanel({ onSectorsChange }: Props) {
  const [tracked, setTracked] = useState<string[]>([])
  const [data, setData]       = useState<Record<string, SectorData>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  // ── localStorage ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setTracked(JSON.parse(saved))
    } catch {}
  }, [])

  function saveSectors(s: string[]) {
    setTracked(s)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
    onSectorsChange?.(s)
  }

  useEffect(() => { onSectorsChange?.(tracked) }, [tracked, onSectorsChange])

  // ── 获取指标 + AI 解读 ────────────────────────────────────────────────────
  const fetchSectorData = useCallback(async (sectorId: string) => {
    if (data[sectorId]) return
    setLoading(prev => new Set([...prev, sectorId]))
    try {
      const res = await fetch(`/api/macro-kpi?sector=${sectorId}&ai=1`).then(r => r.json())
      setData(prev => ({ ...prev, [sectorId]: res }))
    } catch {}
    setLoading(prev => { const s = new Set(prev); s.delete(sectorId); return s })
  }, [data])

  useEffect(() => {
    for (const s of tracked) fetchSectorData(s)
  }, [tracked, fetchSectorData])

  function toggle(s: string) {
    if (tracked.includes(s)) saveSectors(tracked.filter(x => x !== s))
    else { saveSectors([...tracked, s]); fetchSectorData(s) }
  }

  const visible = showAll ? ALL_SECTORS : ALL_SECTORS.slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 板块选择器 ─────────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
          选择关注板块，查看核心基本面指标 + AI 周期解读（月度数据，4h 缓存）
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {visible.map(s => {
            const active = tracked.includes(s)
            const kpi = SECTOR_KPI[s]
            return (
              <button key={s} onClick={() => toggle(s)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: active ? '1px solid #3b82f6' : '1px solid #2a2a2a',
                background: active ? '#1e3a5f' : '#161616',
                color: active ? '#93c5fd' : '#9ca3af',
                transition: 'all 0.15s',
              }}>
                {SECTOR_ICONS[s] || '📊'} {kpi.label}
                {active ? <X size={11} style={{ opacity: 0.7 }} /> : <Plus size={11} style={{ opacity: 0.5 }} />}
              </button>
            )
          })}
          <button onClick={() => setShowAll(v => !v)} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            border: '1px solid #2a2a2a', background: 'transparent', color: '#6b7280',
          }}>
            {showAll ? '收起' : `+${ALL_SECTORS.length - 10} 更多`}
          </button>
        </div>
      </div>

      {/* ── 已选板块面板 ──────────────────────────────────────────────────── */}
      {tracked.length === 0 ? (
        <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '20px 0' }}>
          选择板块后，将显示 CPI、PMI、大宗商品现货等核心基本面指标，AI 自动解读当前周期位置
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tracked.map(s => {
            const kpi       = SECTOR_KPI[s]
            const sData     = data[s]
            const isLoading = loading.has(s)

            return (
              <div key={s} style={{
                background: '#0a0a0a', border: '1px solid #1a1a1a',
                borderRadius: 14, padding: '16px 18px',
              }}>
                {/* 头部 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {SECTOR_ICONS[s] || '📊'} {kpi.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#4b5563', marginLeft: 8 }}>{kpi.desc}</span>
                  </div>
                  <button onClick={() => toggle(s)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 4,
                  }}>
                    <X size={14} />
                  </button>
                </div>

                {isLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', padding: '12px 0' }}>
                    <Loader2 size={14} className="animate-spin" /> 正在拉取基本面数据…
                  </div>
                ) : !sData ? (
                  <div style={{ fontSize: 12, color: '#4b5563' }}>数据加载失败，请刷新页面重试</div>
                ) : (
                  <>
                    {/* 指标卡片 */}
                    {sData.indicators.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                        {sData.indicators.map(ind => <IndicatorCard key={ind.id} ind={ind} />)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 14, padding: '8px 0' }}>
                        该板块暂无基本面数据（需配置 Tushare Token 或等待东财数据源同步）
                      </div>
                    )}

                    {/* AI 周期解读 */}
                    {sData.commentary ? (
                      <div style={{
                        background: '#0f172a', border: '1px solid #1e293b',
                        borderRadius: 10, padding: '12px 14px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                          <Sparkles size={12} color="#818cf8" />
                          <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>AI 周期解读</span>
                          <span style={{ fontSize: 10, color: '#1e3a5f', marginLeft: 4 }}>
                            · {new Date(sData.updatedAt).toLocaleString('zh-CN', {
                              month: 'numeric', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.75, margin: 0 }}>
                          {sData.commentary}
                        </p>
                      </div>
                    ) : sData.indicators.length > 0 ? (
                      <div style={{ fontSize: 11, color: '#1e3a5f' }}>AI 解读生成中…</div>
                    ) : null}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
