'use client'
import { Plus, Check } from 'lucide-react'

interface DayData {
  date: string
  close: number
  pct_chg: number
}

interface Props {
  name: string
  price: number
  change: number
  pct_chg: number
  ma20: number | null
  history: DayData[]
  unit?: string
  onClick?: () => void
  inWatchlist?: boolean
  onWatchlist?: () => void
}

function fmt(n: number): string {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(2) + '万'
  if (Math.abs(n) < 0.01) return n.toFixed(6)
  if (Math.abs(n) < 1) return n.toFixed(4)
  return n.toFixed(2)
}

export default function MarketCard({ name, price, change, pct_chg, ma20, history, unit, onClick, inWatchlist, onWatchlist }: Props) {
  const pos = pct_chg >= 0
  const color = pos ? 'text-up' : 'text-down'
  const sign = pos ? '+' : ''

  const last5 = history.slice(-5)

  return (
    <div
      onClick={onClick}
      className={`bg-bg-card border border-border rounded-xl p-3.5 transition-all ${onClick ? 'cursor-pointer hover:border-accent/50 hover:bg-bg-hover' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 font-medium truncate">{name}</div>
          {price > 0 ? (
            <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
              <span className="text-base font-bold font-mono leading-none">{fmt(price)}</span>
              {unit && <span className="text-[10px] text-gray-600">{unit}</span>}
              <span className={`text-xs font-mono ${color}`}>{sign}{pct_chg.toFixed(2)}%</span>
            </div>
          ) : (
            <div className="text-xs text-gray-600 mt-1 h-5 flex items-center">加载中…</div>
          )}
        </div>
        {/* Watchlist button */}
        {onWatchlist && (
          <button
            onClick={e => { e.stopPropagation(); onWatchlist() }}
            className={`p-1 rounded-md transition-colors flex-shrink-0 ml-1 mt-0.5 ${
              inWatchlist ? 'text-accent bg-accent/10' : 'text-gray-600 hover:text-accent hover:bg-accent/10'
            }`}
            title={inWatchlist ? '移出自选' : '加入自选'}
          >
            {inWatchlist ? <Check size={12} /> : <Plus size={12} />}
          </button>
        )}
      </div>

      {/* 5-day table */}
      {last5.length > 0 && price > 0 && (
        <div className="space-y-0.5 border-t border-border/60 pt-2 mt-1">
          {last5.map((d) => {
            const dp = d.pct_chg >= 0
            const dcol = dp ? 'text-up' : 'text-down'
            const dsign = dp ? '+' : ''
            return (
              <div key={d.date} className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-gray-600 w-10">{d.date.slice(5)}</span>
                <span className="text-gray-300">{fmt(d.close)}</span>
                <span className={`${dcol} w-14 text-right`}>{dsign}{d.pct_chg.toFixed(2)}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* MA20 hint */}
      {ma20 && price > 0 && (
        <div className="mt-1.5 text-[10px] text-gray-700 flex items-center gap-1">
          <span>MA20</span>
          <span className="text-accent font-mono">{fmt(ma20)}</span>
          {price > 0 && (
            <span className={price > ma20 ? 'text-up' : 'text-down'}>
              {price > ma20 ? '↑上方' : '↓下方'}
            </span>
          )}
        </div>
      )}

      {onClick && (
        <div className="mt-1 text-[10px] text-gray-700 hover:text-accent">
          点击查看完整走势 →
        </div>
      )}
    </div>
  )
}
