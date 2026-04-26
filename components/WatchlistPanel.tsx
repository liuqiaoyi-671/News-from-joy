'use client'
import { useState } from 'react'
import { ChevronRight, Search, Loader2, Star, X } from 'lucide-react'
import { INDICATOR_CATALOG } from '@/lib/indicators'

interface Props {
  watchlist: string[]
  onUpdate: (ids: string[]) => void
}

// 申万行业分类 + 国际市场/大宗商品
const CATALOG_GROUPS = [
  // ── A股宽基指数 ──────────────────────────────────────────────────
  { name: 'A股指数',    ids: ['sh', 'sz', 'csi300', 'csi500', 'gem', 'sh50'] },
  // ── 申万行业ETF ──────────────────────────────────────────────────
  { name: '金融',       ids: ['bank_etf', 'broker_etf', 'xbf'] },
  { name: '能源',       ids: ['coal_etf', 'petro_etf'] },
  { name: '新能源',     ids: ['solar_etf', 'li_etf'] },
  { name: '钢铁/有色',  ids: ['metal_etf', 'steel_etf'] },
  { name: '化工',       ids: ['chem_etf'] },
  { name: '半导体/电子', ids: ['chip_etf', 'semi_etf', 'elec_etf'] },
  { name: '计算机',     ids: ['it_etf'] },
  { name: '通信/传媒',  ids: ['tel_etf', 'media_etf'] },
  { name: '军工',       ids: ['def_etf'] },
  { name: '汽车',       ids: ['auto_etf'] },
  { name: '机械设备',   ids: ['mach_etf'] },
  { name: '医药生物',   ids: ['pharma_etf', 'med_etf'] },
  { name: '农林牧渔',   ids: ['agri_etf'] },
  { name: '食品饮料',   ids: ['food_etf', 'liquor_etf'] },
  { name: '家用电器',   ids: ['home_etf'] },
  { name: '房地产/建材', ids: ['re_etf', 'bld_etf'] },
  { name: '公用/交通',  ids: ['util_etf', 'trans_etf'] },
  { name: '环保',       ids: ['env_etf'] },
  // ── 国际市场 ──────────────────────────────────────────────────
  { name: '美股指数',   ids: ['spx', 'ndx', 'dji', 'rut'] },
  { name: '港股/亚太',  ids: ['hsi', 'hstech', 'n225'] },
  { name: '科技/AI个股', ids: ['sox', 'nvda', 'tsm', 'qqq', 'msft', 'googl', 'aapl', 'meta', 'amzn'] },
  { name: '新能源车个股', ids: ['tsla', 'byd_hk'] },
  // ── 宏观/大宗/加密 ──────────────────────────────────────────────
  { name: '宏观/债券',  ids: ['vix', 'ust10y', 'ust2y', 'dxy', 'cnyusd'] },
  { name: '大宗商品',   ids: ['oil', 'gold', 'silver', 'copper', 'natgas'] },
  { name: '农产品期货', ids: ['soybean', 'corn', 'wheat', 'hogs', 'cattle', 'sugar', 'coffee', 'cotton'] },
  { name: '加密货币',   ids: ['btc', 'eth'] },
]

const QUICK_TOPICS = [
  '农业粮食', '新能源光伏', 'AI芯片', '黄金原油', '加密货币',
  '房地产', '医药', '金融银行', '宏观利率', '军工航天',
  '汽车新能源车', '食品白酒', '钢铁有色', '化工',
]

export default function WatchlistPanel({ watchlist, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'browse' | 'ai'>('browse')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [aiLabel, setAiLabel] = useState('')

  function toggle(id: string) {
    if (watchlist.includes(id)) onUpdate(watchlist.filter(i => i !== id))
    else onUpdate([...watchlist, id])
  }

  async function aiSearch(q: string) {
    if (!q.trim()) return
    setLoading(true)
    setSuggestions([])
    setAiLabel(q)
    try {
      const res = await fetch(`/api/ai/suggest?q=${encodeURIComponent(q)}`).then(r => r.json())
      setSuggestions(res.ids || [])
      setAiLabel(res.label || q)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      {/* Header toggle */}
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-bg-hover transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <Star size={14} className="text-accent" />
          <span className="text-sm font-semibold text-gray-200">自选指标库</span>
          {watchlist.length > 0 && (
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{watchlist.length}</span>
          )}
        </div>
        <ChevronRight size={15} className={`text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Current watchlist */}
          {watchlist.length > 0 && (
            <div className="px-5 py-3 border-b border-border bg-bg-primary/40">
              <div className="text-xs text-gray-500 mb-2">已添加 ({watchlist.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {watchlist.map(id => {
                  const ind = INDICATOR_CATALOG[id]
                  if (!ind) return null
                  return (
                    <span key={id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-accent/10 text-accent text-xs rounded-lg border border-accent/20">
                      {ind.name}
                      <button onClick={() => toggle(id)} className="hover:text-white ml-0.5">
                        <X size={9} />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['browse', 'ai'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  tab === t ? 'text-accent border-b-2 border-accent' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'browse' ? '📋 浏览全部指标' : '🤖 AI推荐'}
              </button>
            ))}
          </div>

          {tab === 'browse' && (
            <div className="px-5 py-4 space-y-4 max-h-96 overflow-y-auto">
              {CATALOG_GROUPS.map(group => (
                <div key={group.name}>
                  <div className="text-xs font-medium text-gray-500 mb-2">{group.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.ids.map(id => {
                      const ind = INDICATOR_CATALOG[id]
                      if (!ind) return null
                      const added = watchlist.includes(id)
                      return (
                        <button key={id} onClick={() => toggle(id)}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                            added
                              ? 'bg-accent text-white border-accent'
                              : 'bg-bg-primary border-border text-gray-400 hover:border-accent/60 hover:text-gray-200'
                          }`}
                        >
                          {added ? '✓ ' : ''}{ind.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'ai' && (
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-gray-500">输入您关注的方向，AI基于卖方研报逻辑为您推荐核心跟踪指标</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && aiSearch(query)}
                    placeholder="如：农业、新能源电池、东南亚供应链…"
                    className="w-full pl-8 pr-3 py-2 bg-bg-primary border border-border rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
                  />
                </div>
                <button onClick={() => aiSearch(query)} disabled={loading || !query.trim()}
                  className="px-4 py-2 bg-accent hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded-lg transition-colors flex items-center gap-1.5">
                  {loading ? <Loader2 size={11} className="animate-spin" /> : '推荐'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TOPICS.map(t => (
                  <button key={t} onClick={() => { setQuery(t); aiSearch(t) }}
                    className="text-xs px-2.5 py-1 bg-bg-primary border border-border rounded-full text-gray-500 hover:border-accent/60 hover:text-gray-300 transition-colors">
                    {t}
                  </button>
                ))}
              </div>

              {suggestions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">「{aiLabel}」相关指标（点击添加/移除）</span>
                    <button onClick={() => {
                      const toAdd = suggestions.filter(id => !watchlist.includes(id))
                      onUpdate([...watchlist, ...toAdd])
                    }} className="text-xs text-accent hover:underline">全部添加</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(id => {
                      const ind = INDICATOR_CATALOG[id]
                      if (!ind) return null
                      const added = watchlist.includes(id)
                      return (
                        <button key={id} onClick={() => toggle(id)}
                          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                            added ? 'bg-accent text-white border-accent' : 'bg-bg-primary border-border text-gray-400 hover:border-accent hover:text-accent'
                          }`}>
                          {added ? '✓ ' : '+ '}{ind.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
