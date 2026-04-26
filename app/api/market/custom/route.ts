import { NextRequest, NextResponse } from 'next/server'
import { INDICATOR_CATALOG } from '@/lib/indicators'
import { fetchQuoteAndHistory } from '@/lib/market-fetcher'
import { cached } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').filter(Boolean)
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'
  if (!ids.length) return NextResponse.json({ data: [] })

  // 单 indicator 级别缓存：同 id 不同请求复用
  const results = await Promise.all(
    ids.map(async (id) => {
      const indicator = INDICATOR_CATALOG[id]
      if (!indicator) return null
      return cached(`market:i:${id}`, async () => {
        try {
          const data = await fetchQuoteAndHistory(indicator)
          return { ...indicator, ...data }
        } catch {
          return { ...indicator, price: 0, change: 0, pct_chg: 0, history: [], ma20: null }
        }
      }, { ttl: 30_000, fresh })
    })
  )

  return NextResponse.json({
    data: results.filter(Boolean),
    updatedAt: new Date().toISOString(),
  })
}
