/**
 * 盘后总结生成器（基于 post-market-summary skill 规范）
 *
 * 数据源：
 *  - 行情数据：lib/tushare.ts (A股) + lib/yahoo.ts (港美股)
 *  - 消息面：lib/news.ts (复用爬虫，覆盖财联社、东财、新浪、各券商)
 *
 * 模型：DeepSeek deepseek-chat（V3，长文写作 + 归因分析）
 *   不用 reasoner —— 它对长上下文+长输出会非常慢，盘后 cron 每天只跑一次，用 chat 已足够。
 *
 * 输出：纯文本日报（不带 bullet point，段落式写作）
 */
import { getCNIndices } from './tushare'
import { getUSMarket } from './yahoo'
import { fetchNews, type NewsItem } from './news'
import { chat } from './deepseek'
import { buildUnsubscribeUrl } from './subscribers'

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}年${m}月${day}日`
}

function todayFileStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

interface MarketSnapshot {
  cnIndices: { name: string; close: number; pct_chg: number }[]
  hkIndices: { name: string; close: number; pct_chg: number }[]
  usIndices: { name: string; close: number; pct_chg: number }[]
}

async function gatherMarketData(): Promise<MarketSnapshot> {
  const [cn, us] = await Promise.all([
    getCNIndices().catch(() => []),
    getUSMarket().catch(() => []),
  ])
  // 港股：从 us list 里挑 ^HSI / ^HSCE，否则空
  const hkNames = ['恒生指数', '恒生科技', 'HSI', 'HSCEI']
  const hkIndices = us
    .filter(i => hkNames.some(n => i.name.includes(n)))
    .map(i => ({ name: i.name, close: i.price, pct_chg: i.pct_chg }))
  const usIndices = us
    .filter(i => !hkNames.some(n => i.name.includes(n)))
    .slice(0, 4)
    .map(i => ({ name: i.name, close: i.price, pct_chg: i.pct_chg }))
  return {
    cnIndices: cn.map(i => ({ name: i.name, close: i.close, pct_chg: i.pct_chg })),
    hkIndices,
    usIndices,
  }
}

function buildSourceList(news: NewsItem[]): { numbered: string; sourceMap: Map<string, number> } {
  const map = new Map<string, number>()  // url -> index
  let lines: string[] = []
  news.forEach(n => {
    if (!map.has(n.url)) {
      const idx = map.size + 1
      map.set(n.url, idx)
      lines.push(`[${idx}] ${n.source || '未知'}，${n.title}，${n.url}`)
    }
  })
  return { numbered: lines.join('\n'), sourceMap: map }
}

export async function generatePostmarketReport(): Promise<{
  text: string
  filename: string
  newsCount: number
  modelUsed: string
}> {
  // 1. 抓取行情 + 资讯
  const [market, allNews] = await Promise.all([
    gatherMarketData(),
    fetchNews(undefined, false).catch(() => []),
  ])

  // 仅保留 24 小时内的新闻（盘后总结聚焦当日）
  const now = Date.now()
  const todayNews = allNews
    .filter(n => {
      const t = new Date((n.pubDate || '').replace(' ', 'T')).getTime()
      return !isNaN(t) && now - t < 36 * 3600 * 1000
    })
    .slice(0, 60)  // 最多 60 条，避免 prompt 过长

  const { numbered: sourceList } = buildSourceList(todayNews)

  // 2. 行情数据块
  const marketBlock = [
    '【A股指数】',
    market.cnIndices.map(i => `${i.name}：${i.close.toFixed(2)}（${i.pct_chg >= 0 ? '+' : ''}${i.pct_chg.toFixed(2)}%）`).join('；'),
    market.hkIndices.length ? `【港股】${market.hkIndices.map(i => `${i.name}：${i.close.toFixed(2)}（${i.pct_chg >= 0 ? '+' : ''}${i.pct_chg.toFixed(2)}%）`).join('；')}` : '',
    market.usIndices.length ? `【海外参考】${market.usIndices.map(i => `${i.name}：${i.close.toFixed(2)}（${i.pct_chg >= 0 ? '+' : ''}${i.pct_chg.toFixed(2)}%）`).join('；')}` : '',
  ].filter(Boolean).join('\n')

  // 3. 资讯块
  const newsBlock = todayNews
    .map((n, i) => `[${i + 1}] ${n.title}（${n.source}）：${(n.content || '').slice(0, 200).replace(/\n/g, ' ')}`)
    .join('\n')

  // 4. 提示词（按 skill 输出结构）
  const prompt = `你是A股资深策略研究员，需要基于以下当日行情数据与新闻，撰写一份A股盘后日报。

【今日行情快照】
${marketBlock}

【当日资讯（${todayNews.length}条，编号即来源[N]）】
${newsBlock}

请按以下结构撰写报告，要求：
- 段落式写作，不要 bullet point，不要分割线
- 涉及事实性信息处用方括号标注来源编号 [N]，N 对应上方资讯编号
- 数字必须出自上方"今日行情快照"或资讯，禁止编造
- 归因分析要有逻辑链（事件→影响路径→影响程度），措辞克制（"或""可能""一定程度上"）
- 文风参考卖方策略日报，简洁专业
- 港股部分简要带过即可

报告标题：A股市场日报 ${todayStr()}

板块结构：

一、市场运行情况
（一段话，包括：主要宽基指数当日表现 含点位与涨跌幅；个股涨跌家数与涨停跌停家数 如有数据；全天成交额与放缩量；行业板块涨跌幅排名 涨幅前3+跌幅前3 如能从资讯推断；港股恒指与恒生科技指数表现简述）

二、大盘驱动因素
（先一句话总述当日走势特征，再用"一是…二是…三是…"逐条展开核心驱动因素，按重要性排序，国内与海外因素都涵盖。每条事实性信息需标注 [N]）

三、行业涨跌原因
（选取涨幅最大与跌幅最大的1-2个行业，分别归因。每个行业一段，包含：消息面催化、基本面逻辑、资金行为如有，可提及代表性个股佐证）

四、机构投资者后市展望
（如能从资讯中提取到券商或外资观点，分"内资""外资"两段简述；只搜到一方就只写一段；都没搜到则跳过本板块并说明）

五、资金流向（如有数据则写，无则跳过）
（北向资金、融资融券、ETF 申赎、主力净流入等，从资讯中提取）

六、风险提示（如有则写，无则跳过）

参考来源
（列出报告中所有引用的来源编号、名称、标题、链接，按编号顺序）

请直接输出报告全文，不要任何 meta 说明。来源列表请使用上方提供的资讯编号 [N]，链接列表如下：

${sourceList}`

  const text = await chat(prompt, { model: 'deepseek-chat', temperature: 0.3, maxTokens: 6000 })

  return {
    text,
    filename: `A股市场日报_${todayFileStamp()}.txt`,
    newsCount: todayNews.length,
    modelUsed: 'deepseek-chat',
  }
}

/** 简洁邮件 HTML 包装（保留段落式写作，不破坏来源编号） */
export function buildPostmarketEmailHtml(text: string, recipientEmail?: string): string {
  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // 中文章节标题加粗（一、二、三、… / 参考来源）
    .replace(/^(一、|二、|三、|四、|五、|六、|七、|参考来源)/gm,
      '<h3 style="margin:22px 0 10px;font-size:15px;color:#3b82f6;border-bottom:1px solid #2a2a2a;padding-bottom:6px">$1</h3>')
    // 来源编号 [N] 高亮
    .replace(/\[(\d+)\]/g, '<sup style="color:#9ca3af;font-size:10px">[$1]</sup>')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;background:#0d0d0d;color:#e5e7eb;margin:0;padding:20px}
  .container{max-width:680px;margin:0 auto}
  .header{background:#161616;border:1px solid #2a2a2a;border-radius:10px;padding:20px 24px;margin-bottom:12px}
  .header h1{margin:0;font-size:20px;font-weight:700}
  .header p{margin:5px 0 0;color:#6b7280;font-size:13px}
  .content{background:#161616;border:1px solid #2a2a2a;border-radius:10px;padding:24px;line-height:1.85;font-size:14px}
  .footer{text-align:center;color:#4b5563;font-size:11px;margin-top:16px;line-height:1.6}
  a{color:#3b82f6}
</style></head>
<body><div class="container">
<div class="header"><h1>📊 A股盘后日报</h1><p>${dateStr}</p></div>
<div class="content">${escaped}</div>
<div class="footer">由市场仪表盘自动生成 · DeepSeek 模型撰写<br>AI 内容仅供参考，不构成投资建议<br>${recipientEmail
    ? `<a href="${buildUnsubscribeUrl(recipientEmail)}" style="color:#4b5563;text-decoration:underline">退订</a>`
    : '如需退订请回复此邮件'}</div>
</div></body></html>`
}
