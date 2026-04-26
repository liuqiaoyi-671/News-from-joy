'use client'
import { ResponsiveContainer, LineChart, Line, Tooltip, ReferenceLine } from 'recharts'

interface Props {
  data: { date: string; close: number }[]
  ma20: number | null
  positive: boolean
}

export default function SparklineChart({ data, ma20, positive }: Props) {
  const color = positive ? '#22c55e' : '#ef4444'
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          {ma20 && (
            <ReferenceLine y={ma20} stroke="#3b82f6" strokeDasharray="3 3" strokeWidth={1} />
          )}
          <Line
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
          <Tooltip
            contentStyle={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color }}
            formatter={(v: number) => [v.toFixed(2), '收盘']}
            labelFormatter={(l) => l}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
