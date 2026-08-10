'use client'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts'

interface DayData { date: string; close: number; pct_chg: number }

interface Props {
  data: DayData[]
  name: string
  unit?: string
  height?: number
}

function fmt(n: number): string {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(2) + '万'
  if (Math.abs(n) < 0.01) return n.toFixed(5)
  if (Math.abs(n) < 1) return n.toFixed(4)
  return n.toFixed(2)
}

export default function MarketLineChart({ data, name, unit = '', height = 400 }: Props) {
  if (!data.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-gray-600 text-sm">
        点击上方行情卡片查看走势
      </div>
    )
  }

  const first = data[0].close
  const last  = data[data.length - 1].close
  const isUp  = last >= first
  // A股惯例：涨=红 跌=绿
  const lineColor  = isUp ? '#ef4444' : '#22c55e'
  const fillColor  = isUp ? '#ef444418' : '#22c55e18'

  const totalPct = first ? ((last - first) / first * 100).toFixed(2) : '0.00'
  const pctColor = isUp ? '#ef4444' : '#22c55e'

  const formatted = data.map(d => ({
    ...d,
    label: d.date.slice(5),  // "MM-DD"
  }))

  // Y轴范围留5%边距
  const prices = data.map(d => d.close)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const pad  = (maxP - minP) * 0.06
  const yMin = +(minP - pad).toFixed(4)
  const yMax = +(maxP + pad).toFixed(4)

  // 每隔 N 个显示一个 X 轴刻度，保证不拥挤
  const tickEvery = Math.max(1, Math.floor(data.length / 8))

  return (
    <div style={{ height, position: 'relative' }}>
      {/* 标题行 */}
      <div className="absolute top-3 left-4 z-10 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-gray-300">{name}</span>
        <span className="text-xs font-mono" style={{ color: pctColor }}>
          {isUp ? '+' : ''}{totalPct}%
        </span>
        <span className="text-xs text-gray-600">近{data.length}个交易日</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 36, right: 12, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={lineColor} stopOpacity={0.18} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#4b5563' }}
            tickLine={false}
            axisLine={{ stroke: '#1f1f1f' }}
            interval={tickEvery - 1}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: '#4b5563' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => fmt(v) + (unit ? unit : '')}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: '#111', border: '1px solid #2a2a2a',
              borderRadius: 8, fontSize: 12, color: '#d1d5db',
            }}
            formatter={(value: number) => [`${fmt(value)}${unit}`, name]}
            labelFormatter={l => l}
            cursor={{ stroke: '#4b5563', strokeWidth: 1 }}
          />
          <ReferenceLine y={first} stroke="#4b5563" strokeDasharray="4 4" strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="close"
            stroke={lineColor}
            strokeWidth={1.5}
            fill="url(#chartGrad)"
            dot={false}
            activeDot={{ r: 4, fill: lineColor, stroke: 'transparent' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
