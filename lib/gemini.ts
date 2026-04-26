import axios from 'axios'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

async function generate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key || key.startsWith('你的')) throw new Error('Gemini API key not configured')

  const res = await axios.post(
    `${BASE}?key=${key}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { timeout: 30000 }
  )
  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function summarizeNews(
  articles: { title: string; content: string; url: string }[],
  sector?: string
): Promise<string> {
  const sectorPrompt = sector ? `重点关注与【${sector}】板块相关的内容。` : ''
  const articleList = articles
    .slice(0, 8)
    .map((a, i) => `${i + 1}. 标题：${a.title}\n   摘要：${a.content.slice(0, 250)}\n   链接：${a.url}`)
    .join('\n\n')

  const prompt = `你是一位专业金融分析师，请对以下最新市场资讯进行中文摘要分析。${sectorPrompt}

要求：
- 提炼3-5个关键要点，每点1-2句
- 说明对市场可能的影响
- 语言简洁专业
- 最后以"来源："列出原始链接

原始资讯：
${articleList}`

  return generate(prompt)
}

export async function generateDailySummary(
  marketData: { name: string; pct_chg: number }[],
  topNews: { title: string; url: string }[],
  type: 'premarket' | 'postmarket'
): Promise<string> {
  const marketStr = marketData
    .map((m) => `${m.name}: ${m.pct_chg > 0 ? '+' : ''}${m.pct_chg.toFixed(2)}%`)
    .join('、')
  const newsStr = topNews.map((n, i) => `${i + 1}. ${n.title}\n   ${n.url}`).join('\n')

  const typePrompt =
    type === 'premarket'
      ? '请生成今日盘前要闻简报，分析隔夜市场动态对今日A股和美股可能的影响。'
      : '请生成今日盘后市场总结，回顾今日主要市场表现，分析背后原因和后续值得关注的方向。'

  const prompt = `${typePrompt}

当前市场数据：${marketStr}

最新资讯：
${newsStr}

要求：用中文，300字以内，重点突出，必须附上来源链接。`

  return generate(prompt)
}
