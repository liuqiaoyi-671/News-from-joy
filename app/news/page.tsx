'use client'
import { useEffect, useState, useCallback } from 'react'
import { Loader2, Sparkles, Languages, RefreshCw, ExternalLink, Search, X } from 'lucide-react'
import SectorSelector from '@/components/SectorSelector'

interface NewsItem {
  title: string
  content: string
  url: string
  pubDate: string
  source: string
  sectors: string[]
  lang: 'zh' | 'en'
  translatedTitle?: string
}

function timeAgo(s: string): string {
  if (!s) return ''
  if (/前$|刚刚/.test(s)) return s
  const num = Number(s)
  const d = !isNaN(num) ? new Date(num > 1e10 ? num : num * 1000) : new Date(s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  if (diff < 0) return '刚刚'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h > 48) return `${Math.floor(h / 24)}天前`
  if (h > 0) return `${h}小时前`
  return `${Math.max(m, 1)}分钟前`
}

export default function NewsPage() {
  const [sector, setSector] = useState('all')
  const [query, setQuery] = useState('')          // 已生效的搜索关键词
  const [queryInput, setQueryInput] = useState('') // 输入框内容
  const [articles, setArticles] = useState<NewsItem[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [translateLoading, setTranslateLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState('')

  const load = useCallback(async (s: string, q: string, withTranslate = false) => {
    setLoading(true)
    setSummary(null)
    try {
      const params = new URLSearchParams({ sector: s, noai: '1' })
      if (q) params.set('q', q)
      if (withTranslate) params.set('translate', '1')
      const res = await fetch(`/api/news?${params}`, { cache: 'no-store' }).then((r) => r.json())
      setArticles(res.articles || [])
      setUpdatedAt(res.updatedAt || '')
    } finally {
      setLoading(false)
    }
  }, [])

  const generateSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const params = new URLSearchParams({ sector })
      if (query) params.set('q', query)
      const res = await fetch(`/api/news?${params}`, { cache: 'no-store' }).then((r) => r.json())
      setSummary(res.summary || '摘要生成失败，请稍后重试')
    } finally {
      setSummaryLoading(false)
    }
  }, [sector, query])

  const translateAll = useCallback(async () => {
    setTranslateLoading(true)
    await load(sector, query, true)
    setTranslateLoading(false)
  }, [sector, query, load])

  useEffect(() => { load(sector, query) }, [sector, query, load])

  function handleSectorChange(s: string) {
    setSector(s)
    setSummary(null)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setQuery(queryInput.trim())
    setSummary(null)
  }

  function clearSearch() {
    setQueryInput('')
    setQuery('')
    setSummary(null)
  }

  const enCount = articles.filter((a) => a.lang === 'en' && !a.translatedTitle).length

  return (
    <div className="min-h-screen bg-bg-primary">
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* 搜索框 */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="搜索关键词（全网检索：东财 + 新浪 + 本地资讯池）"
            className="w-full pl-10 pr-20 py-2.5 bg-bg-card border border-border rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              title="清除搜索"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-accent text-white text-xs rounded-md hover:bg-blue-500"
          >
            搜索
          </button>
        </form>

        {/* 当前搜索状态 */}
        {query && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>搜索 <span className="text-accent font-medium">"{query}"</span></span>
            <span className="text-gray-700">·</span>
            <span>{articles.length} 条结果（含全网实时检索）</span>
            {sector !== 'all' && <span className="text-gray-700">·</span>}
            {sector !== 'all' && <span>板块筛选叠加</span>}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectorSelector selected={sector} onChange={handleSectorChange} />
          <div className="flex items-center gap-2">
            {enCount > 0 && (
              <button
                onClick={translateAll}
                disabled={translateLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-bg-card border border-border text-gray-400 hover:border-accent hover:text-accent transition-colors"
              >
                {translateLoading
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Languages size={12} />}
                翻译英文标题 ({enCount})
              </button>
            )}
            <button
              onClick={generateSummary}
              disabled={summaryLoading || articles.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 transition-colors"
            >
              {summaryLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              AI 摘要
            </button>
            <button onClick={() => load(sector, query)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300">
              <RefreshCw size={12} />刷新
            </button>
          </div>
        </div>

        {/* AI Summary */}
        {summary && (
          <div className="bg-bg-card border border-accent/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3 text-accent text-xs font-semibold">
              <Sparkles size={13} />AI 资讯摘要
            </div>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {/* Updated time */}
        {updatedAt && (
          <div className="text-xs text-gray-700">
            更新于 {new Date(updatedAt).toLocaleString('zh-CN')}
          </div>
        )}

        {/* Articles */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            <span>加载资讯中…</span>
          </div>
        ) : (
          <div className="space-y-2">
            {articles.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-bg-card border border-border rounded-xl p-4 hover:border-gray-600 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 group-hover:text-white leading-snug mb-1">
                      {item.translatedTitle || item.title}
                    </p>
                    {item.lang === 'en' && !item.translatedTitle && (
                      <p className="text-xs text-gray-500 leading-snug mb-1">{item.title}</p>
                    )}
                    {item.content && (
                      <p className="text-xs text-gray-600 line-clamp-2 mb-1.5">{item.content.slice(0, 120)}</p>
                    )}
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        item.lang === 'zh' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {item.source}
                      </span>
                      {item.pubDate && (
                        <span className="text-[10px] text-gray-600">{timeAgo(item.pubDate)}</span>
                      )}
                      {item.sectors.slice(0, 2).map((s) => (
                        <span key={s} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                  <ExternalLink size={13} className="text-gray-700 group-hover:text-gray-400 flex-shrink-0 mt-0.5" />
                </div>
              </a>
            ))}
            {articles.length === 0 && !loading && (
              <div className="text-center py-16 text-gray-600">
                <p>暂无相关资讯</p>
                <p className="text-xs mt-1">请检查网络连接或稍后重试</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border mt-8 py-5 text-center text-xs text-gray-700">
        资讯来源：新浪财经 · 东方财富 · 证券时报 · Reuters · CNBC · AI 内容仅供参考
      </footer>
    </div>
  )
}
