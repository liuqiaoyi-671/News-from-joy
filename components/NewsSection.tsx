'use client'
import { ExternalLink, Loader2, BotMessageSquare } from 'lucide-react'

interface NewsItem {
  title: string
  content: string
  url: string
  pubDate: string
  source: string
  sectors: string[]
}

interface Props {
  articles: NewsItem[]
  summary: string | null
  loading: boolean
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h > 24) return `${Math.floor(h / 24)}天前`
  if (h > 0) return `${h}小时前`
  return `${m}分钟前`
}

export default function NewsSection({ articles, summary, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="animate-spin mr-2" size={18} />
        <span>正在加载资讯…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="bg-bg-card border border-accent/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3 text-accent text-sm font-semibold">
            <BotMessageSquare size={16} />
            AI 资讯摘要
          </div>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}
      <div className="space-y-3">
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
                <p className="text-sm font-medium text-gray-200 group-hover:text-white line-clamp-2 mb-1">
                  {item.title}
                </p>
                {item.content && (
                  <p className="text-xs text-gray-500 line-clamp-2">{item.content}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-600">{item.source}</span>
                  {item.pubDate && (
                    <span className="text-xs text-gray-700">{timeAgo(item.pubDate)}</span>
                  )}
                  {item.sectors.length > 0 && (
                    <div className="flex gap-1">
                      {item.sectors.slice(0, 2).map((s) => (
                        <span key={s} className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <ExternalLink size={14} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0 mt-0.5" />
            </div>
          </a>
        ))}
        {articles.length === 0 && (
          <div className="text-center py-12 text-gray-600">暂无相关资讯</div>
        )}
      </div>
    </div>
  )
}
