/**
 * 宏观/行业基本面指标获取
 *
 * 数据来源：
 *   - 国家统计局（NBS）公开 API — CPI、PPI、PMI、社零、工增
 *   - Tushare REST API — M2、社融、SHIBOR
 *   - 东方财富大宗商品 — 锂价、铜价、钢材等实物商品现货
 *
 * 所有数据缓存 4h（月度数据不需要频繁刷新）
 */

import axios from 'axios'

export interface MacroPoint {
  period: string    // e.g. "2026-06"
  value: number
}

export interface MacroIndicator {
  id: string
  name: string
  unit: string
  latest: number
  period: string      // 最新数据所在月份
  mom: number | null  // 环比变化（百分点）
  yoy: number | null  // 同比变化（百分点）
  history: MacroPoint[]  // 近 12 个月
  direction: 'up' | 'down' | 'flat'  // 近3个月趋势方向
}

// ─── Tushare REST 辅助 ────────────────────────────────────────────────────────
async function tushare<T = Record<string, string>>(
  api_name: string,
  params: Record<string, string | number> = {},
  fields = ''
): Promise<T[]> {
  const token = process.env.TUSHARE_TOKEN
  if (!token) return []
  try {
    const res = await axios.post(
      'https://api.tushare.pro',
      { api_name, token, params, fields },
      { timeout: 10000 }
    )
    const data = res.data?.data
    if (!data?.fields || !data?.items) return []
    const keys: string[] = data.fields
    return (data.items as (string | number)[][]).map(row => {
      const obj: Record<string, string | number> = {}
      keys.forEach((k, i) => { obj[k] = row[i] })
      return obj as T
    })
  } catch { return [] }
}

// 将 Tushare 月份字符串 "202606" → "2026-06"
function fmtMonth(m: string): string {
  return m.length === 6 ? `${m.slice(0, 4)}-${m.slice(4)}` : m
}

// 判断近3期趋势
function calcDirection(history: MacroPoint[]): 'up' | 'down' | 'flat' {
  if (history.length < 3) return 'flat'
  const last = history.slice(-3)
  const delta = last[2].value - last[0].value
  if (Math.abs(delta) < 0.1) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

function buildIndicator(
  id: string, name: string, unit: string,
  rows: MacroPoint[]
): MacroIndicator {
  // 按月份去重：同一月份只保留最后一条（Yahoo Finance 当月会返回两条）
  const seen = new Map<string, number>()
  for (const pt of rows) seen.set(pt.period, pt.value)
  const deduped = Array.from(seen.entries())
    .map(([period, value]) => ({ period, value }))
    .sort((a, b) => a.period.localeCompare(b.period))

  const history = deduped.slice(-12)
  const latest  = history[history.length - 1]
  const prev    = history[history.length - 2]
  const yoyPrev = history[history.length - 13] || null  // 去年同期

  const mom = prev ? +(latest.value - prev.value).toFixed(2) : null
  const yoy = yoyPrev ? +(latest.value - yoyPrev.value).toFixed(2) : null
  const direction = calcDirection(history)

  return { id, name, unit, latest: latest.value, period: latest.period, mom, yoy, history, direction }
}

// ─── 宏观通用指标 ─────────────────────────────────────────────────────────────

async function fetchCPI(): Promise<MacroIndicator | null> {
  const rows = await tushare<{ month: string; nt_val: string }>(
    'cn_cpi', {}, 'month,nt_val'
  )
  if (!rows.length) return null
  const pts = rows
    .filter(r => r.month && r.nt_val)
    // Tushare cn_cpi 返回指数值（100 = 与上年同期持平）
    // 减去 100 转换为实际同比涨幅百分比
    .map(r => ({ period: fmtMonth(r.month), value: +(parseFloat(r.nt_val) - 100).toFixed(1) }))
    .sort((a, b) => a.period.localeCompare(b.period))
  return buildIndicator('cpi', 'CPI同比', '%', pts)
}

async function fetchPPI(): Promise<MacroIndicator | null> {
  const rows = await tushare<{ month: string; ppi_yoy: string }>(
    'cn_ppi', {}, 'month,ppi_yoy'
  )
  if (!rows.length) return null
  const pts = rows
    .filter(r => r.month && r.ppi_yoy)
    .map(r => ({ period: fmtMonth(r.month), value: parseFloat(r.ppi_yoy) }))
    .sort((a, b) => a.period.localeCompare(b.period))
  return buildIndicator('ppi', 'PPI同比', '%', pts)
}

async function fetchPMI(): Promise<{ mfg: MacroIndicator | null; srv: MacroIndicator | null }> {
  const rows = await tushare<{ month: string; pmi010000: string; pmi020000: string }>(
    'cn_pmi', {}, 'month,pmi010000,pmi020000'
  )
  if (!rows.length) return { mfg: null, srv: null }
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
  const mfgPts = sorted.filter(r => r.pmi010000).map(r => ({ period: fmtMonth(r.month), value: parseFloat(r.pmi010000) }))
  const srvPts = sorted.filter(r => r.pmi020000).map(r => ({ period: fmtMonth(r.month), value: parseFloat(r.pmi020000) }))
  return {
    mfg: mfgPts.length ? buildIndicator('pmi_mfg', 'PMI制造业', '', mfgPts) : null,
    srv: srvPts.length ? buildIndicator('pmi_srv', 'PMI服务业', '', srvPts) : null,
  }
}

async function fetchM2(): Promise<MacroIndicator | null> {
  // Tushare sf_month: month, m2, m2_yoy
  const rows = await tushare<{ month: string; m2_yoy: string }>(
    'sf_month', {}, 'month,m2_yoy'
  )
  if (!rows.length) return null
  const pts = rows
    .filter(r => r.month && r.m2_yoy)
    .map(r => ({ period: fmtMonth(r.month), value: parseFloat(r.m2_yoy) }))
    .sort((a, b) => a.period.localeCompare(b.period))
  return buildIndicator('m2', 'M2同比', '%', pts)
}

// ─── Yahoo Finance 大宗商品月线 ───────────────────────────────────────────────
// 复用 market-fetcher.ts 的 Yahoo Finance 接口，拉 1 年月线历史
// 用国际基准价替代 A 股期货（定价逻辑一致，数据更稳定）
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

async function fetchYahooCommodity(
  symbol: string, name: string, unit: string
): Promise<MacroIndicator | null> {
  try {
    const enc = encodeURIComponent(symbol)
    const end = Math.floor(Date.now() / 1000)
    const start = end - 365 * 2 * 86400  // 近 2 年月线
    const res = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?interval=1mo&period1=${start}&period2=${end}`,
      { headers: YAHOO_HEADERS, timeout: 10000 }
    )
    const result = res.data?.chart?.result?.[0]
    const timestamps: number[] = result?.timestamp || []
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || []

    const pts: MacroPoint[] = timestamps
      .map((ts, i) => ({
        period: new Date(ts * 1000).toISOString().slice(0, 7),
        value:  closes[i],
      }))
      .filter((d): d is MacroPoint => d.value != null && !isNaN(d.value))
      .slice(-13)  // 近 13 个月

    if (!pts.length) return null
    return buildIndicator(symbol, name, unit, pts)
  } catch { return null }
}

// ─── 每板块指标配置 ───────────────────────────────────────────────────────────

type FetchFn = () => Promise<MacroIndicator | null>

const SECTOR_MACRO_FETCHERS: Record<string, FetchFn[]> = {
  // 宏观板块：国家统计局月度数据（全部来自 Tushare）
  macro: [
    fetchCPI,
    fetchPPI,
    async () => { const r = await fetchPMI(); return r.mfg },
    async () => { const r = await fetchPMI(); return r.srv },
    fetchM2,
  ],
  // 金融板块：货币信用指标
  finance: [
    fetchM2,
    fetchCPI,
  ],
  // 房地产：货币环境 + 通胀
  realestate: [
    fetchCPI,
    fetchM2,
    async () => { const r = await fetchPMI(); return r.mfg },
  ],
  // 能源板块：WTI原油 + 天然气（国际基准，国内定价参考）
  energy: [
    async () => fetchYahooCommodity('CL=F',  'WTI原油',  '$/桶'),
    async () => fetchYahooCommodity('NG=F',  '天然气',   '$/MMBtu'),
  ],
  // 新能源：铜（电池/电机核心原材料）+ 原油（成本端）
  newenergy: [
    async () => fetchYahooCommodity('HG=F',  'COMEX铜',  '$/磅'),
    async () => fetchYahooCommodity('CL=F',  'WTI原油',  '$/桶'),
  ],
  // 农林牧渔：CBOT大豆 + 玉米 + 豆油（国内定价跟随）
  agriculture: [
    async () => fetchYahooCommodity('ZS=F', 'CBOT大豆',  '美分/蒲'),
    async () => fetchYahooCommodity('ZC=F', 'CBOT玉米',  '美分/蒲'),
    async () => fetchYahooCommodity('ZL=F', 'CBOT豆油',  '美分/磅'),
  ],
  // 化工：原油（最大上游原料）
  chemicals: [
    async () => fetchYahooCommodity('CL=F',  'WTI原油',  '$/桶'),
    async () => fetchYahooCommodity('NG=F',  '天然气',   '$/MMBtu'),
  ],
  // 钢铁/有色：铜 + 铝 + 黄金
  metals: [
    async () => fetchYahooCommodity('HG=F',  'COMEX铜',  '$/磅'),
    async () => fetchYahooCommodity('GC=F',  '黄金',     '$/盎司'),
    async () => fetchYahooCommodity('SI=F',  '白银',     '$/盎司'),
  ],
  // 食品饮料：上游成本 + CPI
  food: [
    fetchCPI,
    async () => fetchYahooCommodity('ZS=F', 'CBOT大豆', '美分/蒲'),
    async () => fetchYahooCommodity('ZC=F', 'CBOT玉米', '美分/蒲'),
  ],
  // 医药/半导体/AI/其余：宏观指标
  pharma:       [fetchCPI, async () => { const r = await fetchPMI(); return r.mfg }],
  ai:           [async () => { const r = await fetchPMI(); return r.mfg }, fetchM2],
  semiconductor:[async () => { const r = await fetchPMI(); return r.mfg }, fetchM2],
  auto:         [async () => fetchYahooCommodity('HG=F', 'COMEX铜', '$/磅'), async () => fetchYahooCommodity('CL=F', 'WTI原油', '$/桶')],
  consumer:     [fetchCPI, fetchM2],
  defense:      [async () => { const r = await fetchPMI(); return r.mfg }, fetchM2],
  telecom:      [async () => { const r = await fetchPMI(); return r.mfg }],
  environment:  [async () => fetchYahooCommodity('NG=F', '天然气', '$/MMBtu'), async () => { const r = await fetchPMI(); return r.mfg }],
  transport:    [async () => fetchYahooCommodity('CL=F', 'WTI原油', '$/桶'), fetchM2],
}

// ─── AI 解读 ──────────────────────────────────────────────────────────────────

export async function generateMacroCommentary(
  sectorName: string,
  indicators: MacroIndicator[]
): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key || !indicators.length) return ''

  const summary = indicators.map(ind => {
    const dirText = ind.direction === 'up' ? '上行' : ind.direction === 'down' ? '下行' : '平稳'
    const momText = ind.mom !== null ? `，环比${ind.mom > 0 ? '+' : ''}${ind.mom}${ind.unit}` : ''
    return `${ind.name}：${ind.latest}${ind.unit}（${ind.period}${momText}，近3月趋势${dirText}）`
  }).join('\n')

  const prompt = `你是一名专业的行业研究员，正在撰写${sectorName}板块的基本面简评。

以下是最新宏观/行业指标数据：
${summary}

请根据上述数据写一段简评（3-4句话，约80-120字），需要：
1. 指出关键数据的变化方向和含义
2. 判断当前所处周期位置（复苏/扩张/收缩/底部等）
3. 对该板块的投资含义给出一句结论
不要引入数据中没有的信息，不要使用"可能"等模糊表述，用确定性语气表达数据事实。`

  try {
    const res = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
        stream: false,
      },
      { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    )
    return res.data?.choices?.[0]?.message?.content?.trim() || ''
  } catch { return '' }
}

// ─── 主入口（Next.js unstable_cache — 跨请求持久化，Vercel 友好）────────────
import { unstable_cache } from 'next/cache'

async function _fetchMacroKPI(sectorId: string): Promise<MacroIndicator[]> {
  const fetchers = SECTOR_MACRO_FETCHERS[sectorId]
  if (!fetchers?.length) return []

  const results = await Promise.allSettled(fetchers.map(f => f()))
  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<MacroIndicator>).value)
}

// unstable_cache 在 Vercel 上跨请求持久化（类似 Redis），revalidate=14400=4h
export async function getMacroKPI(sectorId: string): Promise<MacroIndicator[]> {
  const cached = unstable_cache(
    () => _fetchMacroKPI(sectorId),
    [`macro-kpi-${sectorId}`],
    { revalidate: 14400 }  // 4 小时
  )
  return cached()
}
