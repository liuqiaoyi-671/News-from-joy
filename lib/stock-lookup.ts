/**
 * A 股代码解析 — 将 6 位股票代码解析为公司名称
 * 使用东方财富 suggest API（无需 API key）
 */

export interface StockInfo {
  code: string
  name: string
  exchange: 'SH' | 'SZ' | 'BJ' | 'UNKNOWN'
}

/** 判断输入是否为 A 股代码（6 位纯数字，或带市场后缀如 600519.SH） */
export function isStockCode(q: string): boolean {
  return /^\d{6}(\.(SH|SZ|BJ))?$/i.test(q.trim())
}

/**
 * 将股票代码解析为公司信息。
 * 先尝试东方财富，失败后降级至新浪 suggest。
 */
export async function resolveStockCode(query: string): Promise<StockInfo | null> {
  const code = query.trim().replace(/\.(SH|SZ|BJ)$/i, '')
  if (!/^\d{6}$/.test(code)) return null

  // 1. 东方财富 suggest API
  try {
    const res = await fetch(
      `https://searchapi.eastmoney.com/api/suggest/get?input=${code}&type=14&token=D43BF722C8E33BDC906FB84D85E326&count=5`,
      { signal: AbortSignal.timeout(4000) },
    )
    if (res.ok) {
      const j = await res.json()
      const item = j?.QuotationCodeTable?.Data?.[0]
      if (item?.Name && item?.Code === code) {
        const mkt: StockInfo['exchange'] =
          item.MktNum === '1' ? 'SH' : item.MktNum === '0' ? 'SZ' : 'UNKNOWN'
        return { code, name: item.Name, exchange: mkt }
      }
    }
  } catch { /* fallthrough */ }

  // 2. 新浪 suggest（备用）
  // 返回格式：var suggestvalue="600519,贵州茅台,600519,11,贵州茅台,SH,SH600519,沪A,;"
  try {
    const res = await fetch(
      `https://suggest3.sinajs.cn/suggest/type=&key=${code}`,
      { signal: AbortSignal.timeout(3000) },
    )
    if (res.ok) {
      const text = await res.text()
      const m = text.match(/suggestvalue="([^"]+)"/)
      if (m) {
        const first = m[1].split(';')[0]
        const parts = first.split(',')
        // parts: [code, shortName, code, type, fullName, market, ...]
        if (parts.length >= 5 && parts[0] === code) {
          const mkt = parts[5]?.toUpperCase()
          const exchange: StockInfo['exchange'] =
            mkt === 'SH' ? 'SH' : mkt === 'SZ' ? 'SZ' : 'UNKNOWN'
          return { code, name: parts[4] || parts[1], exchange }
        }
      }
    }
  } catch { /* give up */ }

  return null
}
