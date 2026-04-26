import { NextRequest, NextResponse } from 'next/server'
import { fetchNews, searchNews } from '@/lib/news'
import { summarizeNews } from '@/lib/gemini'
import { cached } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get('sector') || 'all'
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const noai = req.nextUrl.searchParams.get('noai') === '1'
  const translate = req.nextUrl.searchParams.get('translate') === '1'
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'

  try {
    // 缓存 key：q / sector / translate 都参与
    const cacheKey = `news:q=${q}:sector=${sector}:t=${translate}`
    let articles = await cached(
      cacheKey,
      () => q
        ? searchNews(q, translate)
        : fetchNews(sector === 'all' ? undefined : sector, translate),
      { ttl: 60_000, fresh }
    )

    // 关键词搜索 + 板块筛选叠加（AND）
    if (q && sector && sector !== 'all') {
      articles = articles.filter(a => a.sectors.includes(sector))
    }

    let summary: string | null = null
    if (!noai && articles.length > 0) {
      const key = process.env.GEMINI_API_KEY
      if (key && !key.startsWith('你的')) {
        try {
          // AI 摘要缓存 5 分钟（内容不会频繁变）
          const sumKey = `summary:${cacheKey}:n=${Math.min(articles.length, 8)}`
          summary = await cached(
            sumKey,
            () => summarizeNews(articles.slice(0, 8), q || (sector !== 'all' ? sector : undefined)),
            { ttl: 5 * 60_000, fresh }
          )
        } catch { summary = null }
      }
    }

    return NextResponse.json({ articles, summary, updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
