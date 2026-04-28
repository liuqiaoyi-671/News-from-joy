import { chat } from './deepseek'
import { fetchNews, type NewsItem } from './news'
import { buildUnsubscribeUrl } from './subscribers'

// ─── 进程级日期缓存：同一天只生成一次简报，节约 token ────────────────────────
let _briefingDate = ''
let _briefingText = ''

// ─── 生成盘前简报（遵循 premarketbriefing 格式） ─────────────────────────────
export async function generatePremarketBriefing(): Promise<{ text: string; articles: NewsItem[] }> {
  // 当天已生成过 → 直接复用
  const today = new Date().toLocaleDateString('zh-CN')
  if (_briefingDate === today && _briefingText) {
    console.log('[briefing] using daily cache')
    return { text: _briefingText, articles: [] }
  }

  const news = await fetchNews(undefined, false)
  // 取最新 30 条作为简报素材（40→30，节约 25% token）
  const top = news.slice(0, 30)

  const text = await buildBriefingText(top)

  // 缓存当天结果
  _briefingDate = today
  _briefingText = text

  return { text, articles: top }
}

async function buildBriefingText(articles: NewsItem[]): Promise<string> {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  const newsText = articles
    .map((n, i) => `${i + 1}. [${n.source}] ${n.title}${n.content ? ' — ' + n.content.slice(0, 80) : ''}\n   链接：${n.url}`)
    .join('\n\n')

  const prompt = `你是一位资深A股卖方研究员，每天开盘前为机构客户撰写简报。今天是${today}。

以下是今日最新财经资讯（按时间排序，共${articles.length}条，摘要已精简）：
${newsText}

请严格按照以下格式生成盘前简报，所有内容必须来自上述资讯，不得编造：

【今日核心3条】
1. 【类别】标题（重要性：高/中；置信度：高/中）
摘要：（2-3句话说明事件内容和背景）
可能影响：（对相关板块或市场的潜在影响）
来源：（引用原始标题 + 链接）

2. （同上）

3. （同上）

【宏观与资金面】
（2-3句概括宏观经济、货币政策、资金面动态，无相关信息可略）

【行业与公司】
（按行业列出2-3条重要信号，每条1-2句，无相关信息可略）

【海外与大宗】
（美股/港股/大宗商品/外汇等1-2条关键信号，每条1句，无相关信息可略）

【盘前一句话结论】
（一句话概括今日市场核心矛盾和最值得关注的方向）

---
注意：语言简洁专业，面向机构投资者，AI内容仅供参考，不构成投资建议。`

  try {
    const text = await chat(prompt, {
      model: 'deepseek-chat',
      temperature: 0.4,
      maxTokens: 3000,
      retries: 2,
    })
    return text.trim() || fallbackBriefing(today, articles)
  } catch {
    return fallbackBriefing(today, articles)
  }
}

function fallbackBriefing(today: string, articles: NewsItem[]): string {
  const lines = articles.slice(0, 10).map(n => `• [${n.source}] ${n.title}`)
  return `${today} 盘前要闻\n\n${lines.join('\n')}\n\n（AI简报暂不可用，以上为最新原始资讯）`
}

// ─── 将简报文本渲染为 HTML 邮件 ────────────────────────────────────────────
export function buildBriefingEmailHtml(briefingText: string, recipientEmail?: string): string {
  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  // 将 Markdown 风格的 【章节】 标题转为 HTML
  const html = briefingText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\【([^】]+)\】/g, '<span style="color:#3b82f6;font-weight:700">【$1】</span>')
    .replace(/^(【[^】]+】.*)/gm, '<h3 style="margin:20px 0 8px;font-size:15px;color:#3b82f6;border-bottom:1px solid #2a2a2a;padding-bottom:6px">$1</h3>')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB',sans-serif;background:#0d0d0d;color:#e5e7eb;margin:0;padding:20px }
  .container { max-width:640px;margin:0 auto }
  .header { background:#161616;border:1px solid #2a2a2a;border-radius:10px;padding:20px 24px;margin-bottom:12px }
  .header h1 { margin:0;font-size:20px;font-weight:700 }
  .header p { margin:5px 0 0;color:#6b7280;font-size:13px }
  .content { background:#161616;border:1px solid #2a2a2a;border-radius:10px;padding:24px;line-height:1.8;font-size:14px }
  .footer { text-align:center;color:#4b5563;font-size:11px;margin-top:16px;line-height:1.6 }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🌅 盘前简报</h1>
    <p>${dateStr}</p>
  </div>
  <div class="content">${html}</div>
  <div class="footer">
    由市场仪表盘自动生成<br>
    AI 内容仅供参考，不构成投资建议<br>
    ${recipientEmail
      ? `<a href="${buildUnsubscribeUrl(recipientEmail)}" style="color:#4b5563;text-decoration:underline">退订</a>`
      : '如需退订请回复此邮件'}
  </div>
</div>
</body>
</html>`
}
