import axios from 'axios'
import { format } from 'date-fns'

// Using Eastmoney + Sina public APIs (no token required)
// secid format: 1.XXXXXX = Shanghai, 0.XXXXXX = Shenzhen

export const CN_INDICES = [
  { code: '000001.SH', name: '上证指数', secid: '1.000001' },
  { code: '399001.SZ', name: '深证成指', secid: '0.399001' },
  { code: '000300.SH', name: '沪深300', secid: '1.000300' },
  { code: '000905.SH', name: '中证500', secid: '1.000905' },
  { code: '399006.SZ', name: '创业板指', secid: '0.399006' },
  { code: '000016.SH', name: '上证50', secid: '1.000016' },
]

export interface IndexData {
  code: string
  name: string
  close: number
  change: number
  pct_chg: number
  vol: number
  history: { date: string; close: number }[]
  ma20: number | null
}

async function fetchEastmoneyKline(secid: string): Promise<{ date: string; close: number; pct_chg: number; pre_close: number }[]> {
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get`
  const res = await axios.get(url, {
    params: {
      secid,
      ut: 'bd1d9ddb04089700cf9c27f6f7426281',
      fields1: 'f1,f2,f3,f4,f5,f6',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      lmt: 30,
      klt: 101,   // daily
      fqt: 0,
      beg: 0,
      end: 20500101,
    },
    headers: {
      'Referer': 'https://finance.eastmoney.com/',
      'User-Agent': 'Mozilla/5.0',
    },
    timeout: 8000,
  })

  const klines: string[] = res.data?.data?.klines || []
  const result = klines.map((line) => {
    const parts = line.split(',')
    // f51=date, f52=open, f53=close, f54=high, f55=low, f57=pct_chg, f59=pre_close
    return {
      date: parts[0],
      close: parseFloat(parts[2]),
      pct_chg: parseFloat(parts[8]),
      pre_close: parseFloat(parts[11]) || parseFloat(parts[2]) - parseFloat(parts[2]) * parseFloat(parts[8]) / 100,
    }
  })
  return result
}

export async function getCNIndices(): Promise<IndexData[]> {
  return Promise.all(
    CN_INDICES.map(async ({ code, name, secid }) => {
      try {
        const rows = await fetchEastmoneyKline(secid)
        if (!rows.length) throw new Error('no data')

        const history = rows.slice(-20).map((r) => ({ date: r.date, close: r.close }))
        const latest = rows[rows.length - 1]
        const closes = history.map((h) => h.close)
        const ma20 = closes.length >= 20 ? closes.reduce((s, v) => s + v, 0) / closes.length : null
        const pre_close = latest.pre_close || (closes.length >= 2 ? closes[closes.length - 2] : latest.close)

        return {
          code,
          name,
          close: latest.close,
          change: latest.close - pre_close,
          pct_chg: latest.pct_chg,
          vol: 0,
          history,
          ma20,
        }
      } catch {
        return { code, name, close: 0, change: 0, pct_chg: 0, vol: 0, history: [], ma20: null }
      }
    })
  )
}
