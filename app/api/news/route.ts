import { NextRequest, NextResponse } from 'next/server'
import { fetchNews, searchNews } from '@/lib/news'
import { cached } from '@/lib/cache'
import { isStockCode, resolveStockCode, StockInfo } from '@/lib/stock-lookup'

export const dynamic = 'force-dynamic'

// DeepSeek 调用点说明（便于维护）：
//   本路由不调用任何 AI — 爬虫是纯 HTTP，noai=1 是前端默认。
//   AI 调用仅在：盘前简报(briefing.ts) / 盘后日报(postmarket.ts) /
//               情绪分析(gemini.ts) / 标题翻译(news.ts translateTitles) /
//               指标推荐(api/ai/suggest)

export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get('sector') || 'all'
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const translate = req.nextUrl.searchParams.get('translate') === '1'
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'

  try {
    // 股票代码解析：6 位数字 → 公司名称（纯 HTTP，不调 AI）
    let searchQ = q
    let resolvedStock: StockInfo | undefined
    if (q && isStockCode(q)) {
      const info = await resolveStockCode(q)
      if (info) { searchQ = info.name; resolvedStock = info }
    }

    const cacheKey = `news:q=${searchQ}:sector=${sector}:t=${translate}`
    let articles = await cached(
      cacheKey,
      () => searchQ
        ? searchNews(searchQ, translate)
        : fetchNews(sector === 'all' ? undefined : sector, translate),
      { ttl: 5 * 60_000, fresh }
    )

    // 关键词搜索 + 板块筛选叠加（AND）
    if (searchQ && sector && sector !== 'all') {
      articles = articles.filter(a => a.sectors.includes(sector))
    }

    return NextResponse.json({ articles, updatedAt: new Date().toISOString(), resolvedStock })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
