'use client'
import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
} from 'recharts'

export interface SentimentSnapshot {
  date: string   // YYYY-MM-DD
  ts: number
  sectors: { id: string; name: string; score: number }[]
}

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b',
  '#84cc16', '#6366f1', '#d946ef', '#0ea5e9', '#10b981',
  '#fb923c', '#a855f7', '#34d399', '#60a5fa',
]

export default function SentimentHistoryChart({ snapshots }: { snapshots: SentimentSnapshot[] }) {
  // 从快照中提取所有板块（以最新快照的顺序为准）
  const allSectors = useMemo(() => {
    const map = new Map<string, string>()
    for (const snap of [...snapshots].reverse()) {
      for (const s of snap.sectors) {
        if (!map.has(s.id)) map.set(s.id, s.name)
      }
    }
    return Array.from(map.entries()).map(([id, name], i) => ({
      id, name, color: PALETTE[i % PALETTE.length],
    }))
  }, [snapshots])

  // 默认显示最新快照中绝对值最大的 6 个板块
  const defaultVisible = useMemo(() => {
    const latest = snapshots[snapshots.length - 1]
    if (!latest) return new Set<string>()
    return new Set(
      [...latest.sectors]
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 6)
        .map(s => s.id),
    )
  }, [snapshots])

  const [visible, setVisible] = useState<Set<string>>(defaultVisible)

  // recharts 数据格式：每行一天
  const chartData = useMemo(() =>
    snapshots.map(snap => {
      const row: Record<string, string | number> = { date: snap.date.slice(5) } // MM-DD
      for (const s of snap.sectors) row[s.id] = s.score
      return row
    }), [snapshots])

  function toggle(id: string) {
    setVisible(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (snapshots.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#4b5563' }}>
        <p style={{ margin: 0, fontSize: 14 }}>暂无历史数据</p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }}>
          每次刷新情绪数据后自动记录，积累 2 天后显示趋势图
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* 板块开关 */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {allSectors.map(s => {
          const on = visible.has(s.id)
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${on ? s.color : '#2a2a2a'}`,
                background: on ? `${s.color}22` : 'transparent',
                color: on ? s.color : '#4b5563',
                transition: 'all 0.12s',
              }}
            >
              {s.name}
            </button>
          )
        })}
        <button
          onClick={() => setVisible(new Set(defaultVisible))}
          style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            border: '1px solid #374151', color: '#6b7280', background: 'transparent',
          }}
        >
          重置
        </button>
        <button
          onClick={() => setVisible(new Set(allSectors.map(s => s.id)))}
          style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            border: '1px solid #374151', color: '#6b7280', background: 'transparent',
          }}
        >
          全选
        </button>
      </div>

      {/* 折线图 */}
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 5, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
          <YAxis domain={[-100, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} tickCount={9} />
          <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 2" label={{ value: '中性', position: 'right', fill: '#4b5563', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9ca3af', marginBottom: 6 }}
            formatter={(v: number, id: string) => {
              const sec = allSectors.find(s => s.id === id)
              return [`${v > 0 ? '+' : ''}${v}`, sec?.name || id]
            }}
          />
          {allSectors.map(s =>
            visible.has(s.id) ? (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            ) : null,
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
