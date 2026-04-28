/**
 * 情绪分析 + 资讯摘要 — 使用 DeepSeek（原 Gemini 接口保持不变，供各路由调用）
 */
import { chat } from './deepseek'

export async function summarizeNews(
  articles: { title: string; content: string; url: string }[],
  sector?: string
): Promise<string> {
  const sectorPrompt = sector ? `重点关注与【${sector}】板块相关的内容。` : ''
  const articleList = articles
    .slice(0, 8)
    .map((a, i) => `${i + 1}. 标题：${a.title}\n   摘要：${a.content.slice(0, 120)}\n   链接：${a.url}`)
    .join('\n\n')

  const prompt = `你是一位专业金融分析师，请对以下最新市场资讯进行中文摘要分析。${sectorPrompt}

要求：
- 提炼3-5个关键要点，每点1-2句
- 说明对市场可能的影响
- 语言简洁专业
- 最后以"来源："列出原始链接

原始资讯：
${articleList}`

  return chat(prompt, { model: 'deepseek-chat', temperature: 0.4, maxTokens: 1500 })
}

/**
 * 批量分析多个板块的情绪 —— 一次 DeepSeek 调用，避免 19 次独立调用各自踩限流
 */
export async function analyzeSectorsBatch(
  sectors: { id: string; name: string; articles: { title: string; content: string }[] }[]
): Promise<Record<string, {
  score: number
  label: string
  confidence: string
  summary: string
  drivers: string[]
}>> {
  if (!sectors.length) return {}

  const blocks = sectors.map(s => {
    const arts = s.articles.slice(0, 5)   // 每板块最多 5 篇（标题是主要信号）
      .map((a, i) => `  ${i + 1}. ${a.title}${a.content ? '：' + a.content.slice(0, 50).replace(/\n/g, ' ') : ''}`)
      .join('\n')
    return `── 板块【${s.id}】${s.name}（${s.articles.length}条）──\n${arts || '  （无资讯）'}`
  }).join('\n\n')

  const prompt = `你是A股资深行业研究员。请基于以下各板块最新资讯，逐个判断情绪。

${blocks}

严格输出 JSON（不要 markdown，不要任何额外文字），格式：
{
  "板块id": {
    "score": 数值(-100到+100, 负=看空, 正=看多),
    "label": "看多"|"偏多"|"中性"|"偏空"|"看空",
    "confidence": "high"|"med"|"low",
    "summary": "一句核心判断(30字内)",
    "drivers": ["驱动1(10-15字)", "驱动2", "..."]
  },
  ...
}

评分：+60~+100看多(明确重大利好)，+20~+59偏多，-19~+19中性，-59~-20偏空，-100~-60看空(重大利空)
confidence: 资讯>=8且一致=high；3-7条或部分矛盾=med；<3条或严重分歧=low
请覆盖以下所有板块ID: ${sectors.map(s => s.id).join(', ')}`

  const raw = await chat(prompt, { model: 'deepseek-chat', temperature: 0.3, maxTokens: 4096, retries: 2 })
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('DeepSeek batch: no JSON in response')
  const parsed: Record<string, {
    score?: number; label?: string; confidence?: string; summary?: string; drivers?: unknown[]
  }> = JSON.parse(jsonMatch[0])

  const out: Record<string, {
    score: number; label: string; confidence: string; summary: string; drivers: string[]
  }> = {}
  for (const id of Object.keys(parsed)) {
    const v = parsed[id] || {}
    out[id] = {
      score: Math.max(-100, Math.min(100, Number(v.score) || 0)),
      label: v.label || '中性',
      confidence: v.confidence || 'low',
      summary: String(v.summary || '').slice(0, 60),
      drivers: Array.isArray(v.drivers) ? v.drivers.slice(0, 4).map(String) : [],
    }
  }
  return out
}

/**
 * 分析单个板块的市场情绪
 */
export async function analyzeSectorSentiment(
  sectorName: string,
  articles: { title: string; content: string }[]
): Promise<{
  score: number
  label: '看多' | '偏多' | '中性' | '偏空' | '看空'
  confidence: 'high' | 'med' | 'low'
  summary: string
  drivers: string[]
}> {
  if (!articles.length) {
    return { score: 0, label: '中性', confidence: 'low', summary: '暂无足够资讯', drivers: [] }
  }
  const articleList = articles
    .slice(0, 8)
    .map((a, i) => `${i + 1}. ${a.title}${a.content ? '\n   ' + a.content.slice(0, 100) : ''}`)
    .join('\n\n')

  const prompt = `你是A股资深行业研究员。请基于下列【${sectorName}】板块最新资讯，判断市场情绪。

资讯：
${articleList}

请严格以 JSON 格式输出（不要任何额外文字、不要 markdown 代码块）：
{
  "score": 数值, // -100到+100, 负数=利空/看空, 正数=利多/看多, 0=中性
  "label": "看多" | "偏多" | "中性" | "偏空" | "看空",
  "confidence": "high" | "med" | "low",
  "summary": "一句话核心判断（30字以内）",
  "drivers": ["驱动因素1（10-15字）", "驱动因素2", "..."]  // 2-4条
}

评分标准：
+60~+100 看多：明确重大利好（政策刺激/业绩超预期/行业拐点）
+20~+59  偏多：偏正面消息为主
-19~+19  中性：消息混杂或无明显方向
-59~-20  偏空：偏负面消息为主
-100~-60 看空：重大利空（监管打压/业绩暴雷/行业景气度下行）

confidence 取决于资讯数量与一致性：>=8条且一致=high；3-7条或部分矛盾=med；<3条或严重分歧=low`

  const raw = await chat(prompt, { model: 'deepseek-chat', temperature: 0.3, maxTokens: 1024 })
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { score: 0, label: '中性', confidence: 'low', summary: 'AI解析失败', drivers: [] }
  }
  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      score: Math.max(-100, Math.min(100, Number(parsed.score) || 0)),
      label: parsed.label || '中性',
      confidence: parsed.confidence || 'low',
      summary: String(parsed.summary || '').slice(0, 60),
      drivers: Array.isArray(parsed.drivers) ? parsed.drivers.slice(0, 4).map(String) : [],
    }
  } catch {
    return { score: 0, label: '中性', confidence: 'low', summary: 'AI解析失败', drivers: [] }
  }
}
