'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import MarketCard from '@/components/MarketCard'
import WatchlistPanel from '@/components/WatchlistPanel'
import DetailModal from '@/components/DetailModal'
import { BASE_CN, BASE_US, INDICATOR_CATALOG } from '@/lib/indicators'

interface DayData { date: string; close: number; pct_chg: number }
interface MarketItem {
  id: string; name: string; price?: number; close?: number
  change: number; pct_chg: number; history: DayData[]
  ma20: number | null; unit?: string; description?: string
}
type ModalItem = { id: string; name: string; price: number; change: number; pct_chg: number; ma20: number | null; history: DayData[]; unit?: string; description?: string }

const US_GROUPS: Record<string, string[]> = {
  '股指': ['spx', 'ndx', 'dji'],
  '情绪/债券': ['vix', 'ust10y'],
  '大宗商品': ['oil', 'gold'],
  '外汇/加密': ['dxy', 'btc'],
}

function useLocalStorage<T>(key: string, init: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    if (typeof window === 'undefined') return init
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? init } catch { return init }
  })
  const set = useCallback((v: T) => {
    setVal(v)
    if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(v))
  }, [key])
  return [val, set]
}

export default function Dashboard() {
  const [cnData, setCnData]   = useState<MarketItem[]>([])
  const [usData, setUsData]   = useState<MarketItem[]>([])
  const [watchData, setWatchData] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [watchLoading, setWatchLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [selected, setSelected] = useState<ModalItem | null>(null)
  const [watchlist, setWatchlist] = useLocalStorage<string[]>('market-watchlist', [])

  const fetchBase = useCallback(async () => {
    setLoading(true)
    try {
      const [cnRes, usRes] = await Promise.all([
        fetch('/api/market/cn', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/market/us', { cache: 'no-store' }).then(r => r.json()),
      ])
      if (cnRes.data) setCnData(cnRes.data)
      if (usRes.data) setUsData(usRes.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const fetchWatchlist = useCallback(async (ids: string[]) => {
    if (!ids.length) { setWatchData([]); return }
    setWatchLoading(true)
    try {
      const res = await fetch(`/api/market/custom?ids=${ids.join(',')}`, { cache: 'no-store' }).then(r => r.json())
      if (res.data) setWatchData(res.data)
    } finally { setWatchLoading(false) }
  }, [])

  useEffect(() => { fetchBase() }, [fetchBase])
  useEffect(() => { fetchWatchlist(watchlist) }, [watchlist, fetchWatchlist])
  useEffect(() => {
    const id = setInterval(() => { fetchBase(); fetchWatchlist(watchlist); setLastRefresh(new Date()) }, 3600000)
    return () => clearInterval(id)
  }, [fetchBase, fetchWatchlist, watchlist])

  function handleRefresh() { fetchBase(); fetchWatchlist(watchlist); setLastRefresh(new Date()) }

  function getItem(id: string, list: MarketItem[]): MarketItem | undefined {
    return list.find(d => d.id === id)
  }

  function toModal(item: MarketItem): ModalItem {
    return { ...item, price: item.price ?? item.close ?? 0 }
  }

  function openDetail(item: MarketItem) { setSelected(toModal(item)) }

  function toggleWatchlist(id: string) {
    if (watchlist.includes(id)) setWatchlist(watchlist.filter(i => i !== id))
    else setWatchlist([...watchlist, id])
  }

  const allLoaded = [...cnData, ...usData, ...watchData]

  return (
    <div className="min-h-screen bg-bg-primary">
      <main className="max-w-7xl mx-auto px-4 py-5 space-y-6">

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">
            上次刷新 {lastRefresh.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={handleRefresh} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            <RefreshCw size={13} />刷新
          </button>
        </div>

        {/* A股 */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">🇨🇳 A股指数</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-600 text-sm py-6 justify-center"><Loader2 size={15} className="animate-spin" />加载中…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {BASE_CN.map(id => {
                const item = getItem(id, cnData)
                const ind = INDICATOR_CATALOG[id]
                return (
                  <MarketCard key={id}
                    name={item?.name ?? ind?.name ?? id}
                    price={item?.close ?? item?.price ?? 0}
                    change={item?.change ?? 0} pct_chg={item?.pct_chg ?? 0}
                    ma20={item?.ma20 ?? null} history={item?.history ?? []}
                    inWatchlist={watchlist.includes(id)}
                    onWatchlist={() => toggleWatchlist(id)}
                    onClick={() => item && openDetail({ ...item, price: item.close ?? item.price ?? 0 })}
                  />
                )
              })}
            </div>
          )}
        </section>

        {/* 美股 & 宏观 */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">🇺🇸 美股 & 宏观</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-600 text-sm py-6 justify-center"><Loader2 size={15} className="animate-spin" />加载中…</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(US_GROUPS).map(([group, ids]) => (
                <div key={group}>
                  <h3 className="text-xs text-gray-600 mb-2">{group}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {ids.map(id => {
                      const item = getItem(id, usData)
                      const ind = INDICATOR_CATALOG[id]
                      return (
                        <MarketCard key={id}
                          name={item?.name ?? ind?.name ?? id}
                          price={item?.price ?? 0}
                          change={item?.change ?? 0} pct_chg={item?.pct_chg ?? 0}
                          ma20={item?.ma20 ?? null} history={item?.history ?? []}
                          unit={item?.unit ?? ind?.unit}
                          inWatchlist={watchlist.includes(id)}
                          onWatchlist={() => toggleWatchlist(id)}
                          onClick={() => item && openDetail(item)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Watchlist */}
        <section>
          <WatchlistPanel watchlist={watchlist} onUpdate={setWatchlist} />
          {watchlist.length > 0 && (
            <div className="mt-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">⭐ 我的自选</h2>
              {watchLoading ? (
                <div className="flex items-center gap-2 text-gray-600 text-sm py-6 justify-center"><Loader2 size={15} className="animate-spin" />加载中…</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {watchlist.map(id => {
                    const item = watchData.find(d => d.id === id)
                    const ind = INDICATOR_CATALOG[id]
                    if (!ind) return null
                    return (
                      <MarketCard key={id}
                        name={item?.name ?? ind.name}
                        price={item?.price ?? item?.close ?? 0}
                        change={item?.change ?? 0} pct_chg={item?.pct_chg ?? 0}
                        ma20={item?.ma20 ?? null} history={item?.history ?? []}
                        unit={item?.unit ?? ind.unit}
                        inWatchlist={true}
                        onWatchlist={() => toggleWatchlist(id)}
                        onClick={() => item && openDetail({ ...item, price: item.price ?? item.close ?? 0 })}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </section>

      </main>

      <DetailModal
        item={selected}
        onClose={() => setSelected(null)}
        inWatchlist={selected ? watchlist.includes(selected.id) : false}
        onWatchlist={selected ? () => toggleWatchlist(selected.id) : undefined}
      />

      <footer className="border-t border-border mt-8 py-5 text-center text-xs text-gray-700">
        市场仪表盘 · 数据每小时自动更新 · AI 内容仅供参考，不构成投资建议
      </footer>
    </div>
  )
}
