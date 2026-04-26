import axios from 'axios'
import { format, subDays } from 'date-fns'
import type { Indicator } from './indicators'

export interface DayData {
  date: string
  close: number
  pct_chg: number
}

export interface MarketData {
  price: number
  change: number
  pct_chg: number
  history: DayData[]
  ma20: number | null
}

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

// Sina Finance symbol mapping for all cn_index instruments
// Format: Yahoo symbol → Sina symbol (sh/sz prefix + 6-digit code)
const SINA_SYMBOL_MAP: Record<string, string> = {
  // A股主要指数
  '000001.SS': 'sh000001',  // 上证
  '399001.SZ': 'sz399001',  // 深证成指
  '000300.SS': 'sh000300',  // 沪深300
  '000905.SS': 'sh000905',  // 中证500
  '399006.SZ': 'sz399006',  // 创业板
  '000016.SS': 'sh000016',  // 上证50
  // 金融行业ETF
  '512800.SS': 'sh512800',  // 银行ETF
  '512000.SS': 'sh512000',  // 券商ETF
  '159931.SZ': 'sz159931',  // 非银ETF
  // 能源行业ETF
  '515220.SS': 'sh515220',  // 煤炭ETF
  '159731.SZ': 'sz159731',  // 石油石化ETF
  // 有色金属 & 钢铁ETF
  '512400.SS': 'sh512400',  // 有色金属ETF
  '515210.SS': 'sh515210',  // 钢铁ETF
  // 化工ETF
  '516020.SS': 'sh516020',  // 化工ETF
  // 电子 & 半导体ETF
  '515260.SS': 'sh515260',  // 电子ETF
  '159995.SZ': 'sz159995',  // 芯片ETF
  '512480.SS': 'sh512480',  // 半导体ETF
  // 计算机ETF
  '512720.SS': 'sh512720',  // 计算机ETF
  // 通信 & 传媒ETF
  '515880.SS': 'sh515880',  // 通信ETF
  '512980.SS': 'sh512980',  // 传媒ETF
  // 军工ETF
  '512660.SS': 'sh512660',  // 军工ETF
  // 汽车ETF
  '516110.SS': 'sh516110',  // 汽车ETF
  // 机械ETF
  '159886.SZ': 'sz159886',  // 机械ETF
  // 医药ETF
  '159929.SZ': 'sz159929',  // 医药ETF
  '512170.SS': 'sh512170',  // 医疗ETF
  // 农业ETF
  '159825.SZ': 'sz159825',  // 农业ETF
  // 食品饮料ETF
  '515170.SS': 'sh515170',  // 食品饮料ETF
  '512690.SS': 'sh512690',  // 白酒ETF
  // 家电ETF
  '159996.SZ': 'sz159996',  // 家电ETF
  // 新能源ETF
  '515790.SS': 'sh515790',  // 光伏ETF
  '159766.SZ': 'sz159766',  // 碳酸锂ETF
  // 房地产 & 建材ETF
  '159726.SZ': 'sz159726',  // 房地产ETF
  '159745.SZ': 'sz159745',  // 建材ETF
  // 公用事业 & 交通运输ETF
  '159611.SZ': 'sz159611',  // 公用事业ETF
  '159666.SZ': 'sz159666',  // 交通运输ETF
  // 环保ETF
  '512580.SS': 'sh512580',  // 环保ETF
}

async function fetchSinaHistory(sinaSymbol: string): Promise<DayData[]> {
  const res = await axios.get(
    'https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData',
    {
      params: { symbol: sinaSymbol, scale: 240, datalen: 200, ma: 'no' },
      headers: { ...HEADERS, Referer: 'https://finance.sina.com.cn/' },
      timeout: 8000,
    }
  )
  const rows: { day: string; close: string }[] = Array.isArray(res.data) ? res.data : []
  return rows.map((r, i) => {
    const close = parseFloat(r.close)
    const prevClose = i > 0 ? parseFloat(rows[i - 1].close) : close
    return {
      date: r.day,
      close,
      pct_chg: prevClose ? (close - prevClose) / prevClose * 100 : 0,
    }
  })
}

async function fetchSinaQuote(sinaSymbol: string): Promise<{ price: number; change: number; pct_chg: number }> {
  const res = await axios.get(
    `https://hq.sinajs.cn/list=${sinaSymbol}`,
    { headers: { ...HEADERS, Referer: 'https://finance.sina.com.cn/' }, timeout: 5000 }
  )
  // Format: var hq_str_sh000001="上证综合指数,3275.06,3278.68,...,-2.22,-0.07,...";
  const match = res.data?.match(/="([^"]+)"/)
  if (!match) return { price: 0, change: 0, pct_chg: 0 }
  const parts = match[1].split(',')
  const price = parseFloat(parts[3]) || parseFloat(parts[1]) || 0
  const prevClose = parseFloat(parts[2]) || price
  const change = price - prevClose
  const pct_chg = prevClose ? change / prevClose * 100 : 0
  return { price, change, pct_chg }
}

async function fetchCNIndex(symbol: string): Promise<MarketData> {
  const sinaSymbol = SINA_SYMBOL_MAP[symbol]
  if (!sinaSymbol) throw new Error(`No Sina mapping for ${symbol}`)

  const [quote, history] = await Promise.all([
    fetchSinaQuote(sinaSymbol),
    fetchSinaHistory(sinaSymbol),
  ])

  const recent20 = history.slice(-20)
  const ma20 = recent20.length >= 20
    ? recent20.reduce((s, v) => s + v.close, 0) / recent20.length
    : null

  return { ...quote, history, ma20 }
}

async function fetchYahoo(symbol: string): Promise<MarketData> {
  const enc = encodeURIComponent(symbol)
  const end = Math.floor(Date.now() / 1000)
  const start = Math.floor(subDays(new Date(), 200).getTime() / 1000)

  const [quoteRes, histRes] = await Promise.all([
    axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${enc}?interval=1d&range=1d`,
      { headers: HEADERS, timeout: 8000 }),
    axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${enc}?interval=1d&period1=${start}&period2=${end}`,
      { headers: HEADERS, timeout: 8000 }),
  ])

  const meta = quoteRes.data?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice ?? 0
  const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price
  const change = price - prev
  const pct_chg = prev ? (change / prev) * 100 : 0

  const result = histRes.data?.chart?.result?.[0]
  const timestamps: number[] = result?.timestamp || []
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || []

  const rawHistory = timestamps
    .map((ts, i) => ({ date: format(new Date(ts * 1000), 'yyyy-MM-dd'), close: closes[i] }))
    .filter((d): d is { date: string; close: number } => d.close != null && !isNaN(d.close))

  const history: DayData[] = rawHistory.map((d, i) => {
    const prevClose = i > 0 ? rawHistory[i - 1].close : d.close
    return { date: d.date, close: d.close, pct_chg: prevClose ? (d.close - prevClose) / prevClose * 100 : 0 }
  })

  const recent20 = history.slice(-20)
  const ma20 = recent20.length >= 20 ? recent20.reduce((s, v) => s + v.close, 0) / recent20.length : null

  return { price, change, pct_chg, history, ma20 }
}

export async function fetchQuoteAndHistory(indicator: Indicator): Promise<MarketData> {
  const symbol = indicator.symbol
  if (!symbol) throw new Error(`No symbol for ${indicator.id}`)

  // Use Sina for CN indices/ETFs, Yahoo for everything else
  if (indicator.type === 'cn_index' && SINA_SYMBOL_MAP[symbol]) {
    return fetchCNIndex(symbol)
  }
  return fetchYahoo(symbol)
}
