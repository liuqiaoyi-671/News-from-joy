import { NextRequest, NextResponse } from 'next/server'
import { BASE_CN, INDICATOR_CATALOG } from '@/lib/indicators'
import { fetchQuoteAndHistory } from '@/lib/market-fetcher'
import { cached } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'
  try {
    const data = await cached('market:cn', async () => {
      return Promise.all(
        BASE_CN.map(async (id) => {
          const indicator = INDICATOR_CATALOG[id]
          const market = await fetchQuoteAndHistory(indicator).catch(() => ({
            price: 0, change: 0, pct_chg: 0, history: [], ma20: null,
          }))
          return { ...indicator, close: market.price, ...market }
        })
      )
    }, { ttl: 30_000, fresh })
    return NextResponse.json({ data, updatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
