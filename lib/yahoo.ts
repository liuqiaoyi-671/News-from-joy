import axios from 'axios'
import { format, subDays } from 'date-fns'

export const US_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', group: '股指' },
  { symbol: '^IXIC', name: '纳斯达克', group: '股指' },
  { symbol: '^DJI', name: '道琼斯', group: '股指' },
  { symbol: '^RUT', name: '罗素2000', group: '股指' },
  { symbol: '^VIX', name: 'VIX恐慌指数', group: '情绪' },
  { symbol: '^TNX', name: '10年期美债', group: '债券' },
  { symbol: 'CL=F', name: 'WTI原油', group: '大宗商品' },
  { symbol: 'GC=F', name: '黄金', group: '大宗商品' },
  { symbol: 'DX-Y.NYB', name: '美元指数', group: '外汇' },
  { symbol: 'BTC-USD', name: '比特币', group: '加密货币' },
]

export interface MarketItem {
  symbol: string
  name: string
  group: string
  price: number
  change: number
  pct_chg: number
  history: { date: string; close: number }[]
  ma20: number | null
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'application/json',
}

async function fetchQuote(symbol: string): Promise<{ price: number; change: number; pct_chg: number }> {
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`
  const res = await axios.get(url, { headers: HEADERS, timeout: 8000 })
  const meta = res.data?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice ?? 0
  const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price
  const change = price - prev
  const pct_chg = prev ? (change / prev) * 100 : 0
  return { price, change, pct_chg }
}

async function fetchHistory(symbol: string): Promise<{ date: string; close: number }[]> {
  const end = Math.floor(Date.now() / 1000)
  const start = Math.floor(subDays(new Date(), 40).getTime() / 1000)
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&period1=${start}&period2=${end}`
  const res = await axios.get(url, { headers: HEADERS, timeout: 8000 })
  const result = res.data?.chart?.result?.[0]
  if (!result) return []
  const timestamps: number[] = result.timestamp || []
  const closes: number[] = result.indicators?.quote?.[0]?.close || []
  return timestamps
    .map((ts, i) => ({ date: format(new Date(ts * 1000), 'yyyy-MM-dd'), close: closes[i] }))
    .filter((d) => d.close != null)
    .slice(-20)
}

export async function getUSMarket(): Promise<MarketItem[]> {
  return Promise.all(
    US_INDICES.map(async ({ symbol, name, group }) => {
      try {
        const [quote, history] = await Promise.all([fetchQuote(symbol), fetchHistory(symbol)])
        const closes = history.map((h) => h.close)
        const ma20 = closes.length >= 20 ? closes.reduce((s, v) => s + v, 0) / closes.length : null
        return { symbol, name, group, ...quote, history, ma20 }
      } catch {
        return { symbol, name, group, price: 0, change: 0, pct_chg: 0, history: [], ma20: null }
      }
    })
  )
}
