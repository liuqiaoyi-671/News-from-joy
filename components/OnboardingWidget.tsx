'use client'
import { useState } from 'react'
import { Search, Loader2, X, ChevronRight } from 'lucide-react'
import { INDICATOR_CATALOG } from '@/lib/indicators'

interface Props {
  customIds: string[]
  onUpdate: (ids: string[]) => void
}

const QUICK_TOPICS = ['农业', '新能源', 'AI & 半导体', '黄金', '原油', '加密货币', '房地产', '医药', '金融']

export default function OnboardingWidget({ customIds, onUpdate }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [label, setLabel] = useState('')
  const [expanded, setExpanded] = useState(customIds.length === 0)

  async function search(q: string) {
    if (!q.trim()) return
    setLoading(true)
    setSuggestions([])
    setLabel(q)
    try {
      const res = await fetch(`/api/ai/suggest?q=${encodeURIComponent(q)}`).then((r) => r.json())
      setSuggestions(res.ids || [])
      setLabel(res.label || q)
    } finally {
      setLoading(false)
    }
  }

  function toggle(id: string) {
    if (customIds.includes(id)) {
      onUpdate(customIds.filter((i) => i !== id))
    } else {
      onUpdate([...customIds, id])
    }
  }

  function addAll() {
    const toAdd = suggestions.filter((id) => !customIds.includes(id))
    onUpdate([...customIds, ...toAdd])
  }

  function removeCustom(id: string) {
    onUpdate(customIds.filter((i) => i !== id))
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200">🎯 自定义关注指标</span>
          {customIds.length > 0 && (
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">{customIds.length} 项</span>
          )}
        </div>
        <ChevronRight size={16} className={`text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">
          {/* Search */}
          <div className="pt-4">
            <p className="text-xs text-gray-500 mb-3">输入您最近在关注的方向（如：农业、新能源、半导体），AI 将为您推荐相关指标</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search(query)}
                  placeholder="输入关注方向…"
                  className="w-full pl-8 pr-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
                />
              </div>
              <button
                onClick={() => search(query)}
                disabled={loading || !query.trim()}
                className="px-4 py-2 bg-accent hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : '搜索'}
              </button>
            </div>
            {/* Quick topics */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_TOPICS.map((t) => (
                <button key={t} onClick={() => { setQuery(t); search(t) }}
                  className="text-xs px-2.5 py-1 bg-bg-primary border border-border rounded-full text-gray-400 hover:border-accent hover:text-accent transition-colors">
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">「{label}」相关指标建议</span>
                <button onClick={addAll} className="text-xs text-accent hover:underline">全部添加</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((id) => {
                  const ind = INDICATOR_CATALOG[id]
                  if (!ind) return null
                  const added = customIds.includes(id)
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        added
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg-primary border-border text-gray-400 hover:border-accent hover:text-accent'
                      }`}
                    >
                      {added ? '✓ ' : '+ '}{ind.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Current custom */}
          {customIds.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">当前自定义指标</div>
              <div className="flex flex-wrap gap-2">
                {customIds.map((id) => {
                  const ind = INDICATOR_CATALOG[id]
                  if (!ind) return null
                  return (
                    <span key={id} className="flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent text-xs rounded-lg border border-accent/20">
                      {ind.name}
                      <button onClick={() => removeCustom(id)} className="hover:text-white ml-0.5">
                        <X size={10} />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
