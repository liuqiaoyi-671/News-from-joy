'use client'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'

interface Props {
  data: { date: string; close: number }[]
  ma20: number | null
  positive: boolean
}

export default function FullChart({ data, ma20, positive }: Props) {
  const color = positive ? '#22c55e' : '#ef4444'
  const values = data.map((d) => d.close)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const pad = (maxV - minV) * 0.05

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
          <YAxis domain={[minV - pad, maxV + pad]} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => v.toFixed(Math.abs(v) < 10 ? 2 : 0)} width={50} />
          {ma20 && <ReferenceLine y={ma20} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} />}
          <Line type="monotone" dataKey="close" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color }} />
          <Tooltip
            contentStyle={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color }}
            formatter={(v: number) => [v.toFixed(Math.abs(v) < 10 ? 4 : 2), '价格']}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
