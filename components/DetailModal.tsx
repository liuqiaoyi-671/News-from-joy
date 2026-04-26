'use client'
import { X, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const FullChart = dynamic(() => import('./FullChart'), { ssr: false })

interface DayData { date: string; close: number; pct_chg: number }

interface Props {
  item: { id: string; name: string; price: number; change: number; pct_chg: number; ma20: number | null; history: DayData[]; unit?: string; description?: string } | null
  onClose: () => void
  inWatchlist?: boolean
  onWatchlist?: () => void
}

const PERIODS = [
  { label: '5日',   days: 5 },
  { label: '20日',  days: 20 },
  { label: '3个月', days: 90 },
  { label: '6个月', days: 180 },
]

export default function DetailModal({ item, onClose, inWatchlist, onWatchlist }: Props) {
  const [period, setPeriod] = useState(20)

  useEffect(() => {
    if (!item) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [item, onClose])

  if (!item) return null

  const pos = item.pct_chg >= 0
  const color = pos ? 'text-up' : 'text-down'
  const sign = pos ? '+' : ''
  const fmt = (n: number) => Math.abs(n) < 0.01 ? n.toFixed(6) : Math.abs(n) < 1 ? n.toFixed(4) : n.toFixed(2)

  const displayHistory = item.history.slice(-period)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">{item.name}</h2>
            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {onWatchlist && (
              <button onClick={onWatchlist}
                className={`p-1.5 rounded-lg transition-colors ${inWatchlist ? 'text-amber-400 bg-amber-400/10' : 'text-gray-500 hover:text-amber-400 hover:bg-amber-400/10'}`}
                title={inWatchlist ? '移出自选' : '加入自选'}>
                <Star size={15} fill={inWatchlist ? 'currentColor' : 'none'} />
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1"><X size={18} /></button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
          {[
            { label: '当前价格', value: `${fmt(item.price)}${item.unit ? ' ' + item.unit : ''}`, cls: 'text-gray-100' },
            { label: '涨跌幅',   value: `${sign}${item.pct_chg.toFixed(2)}%`, cls: color },
            { label: '涨跌额',   value: `${sign}${fmt(item.change)}`, cls: color },
            { label: 'MA20',     value: item.ma20 ? fmt(item.ma20) : '—', cls: 'text-accent' },
          ].map(s => (
            <div key={s.label} className="px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className={`text-base font-bold font-mono ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 px-5 pt-4">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p.days ? 'bg-accent text-white' : 'bg-bg-primary text-gray-500 hover:text-gray-300 border border-border'
              }`}>
              {p.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-600">
            {displayHistory.length > 0 && `${displayHistory[0].date} — ${displayHistory[displayHistory.length - 1].date}`}
          </span>
        </div>

        {/* Chart */}
        <div className="px-5 pb-5 pt-3">
          {displayHistory.length > 1 ? (
            <FullChart data={displayHistory} ma20={period <= 20 ? item.ma20 : null} positive={pos} />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">暂无足够历史数据</div>
          )}
        </div>

        {/* Daily table for short periods */}
        {period <= 20 && displayHistory.length > 0 && (
          <div className="px-5 pb-5 border-t border-border pt-3">
            <div className="text-xs text-gray-500 mb-2">逐日数据</div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              {[...displayHistory].reverse().map(d => {
                const dp = d.pct_chg >= 0
                return (
                  <div key={d.date} className="flex justify-between text-xs font-mono">
                    <span className="text-gray-600">{d.date.slice(5)}</span>
                    <span className="text-gray-300">{fmt(d.close)}</span>
                    <span className={dp ? 'text-up' : 'text-down'}>{dp ? '+' : ''}{d.pct_chg.toFixed(2)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
