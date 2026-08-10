import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { getArticlesForSector } from '@/lib/news'
import { cached } from '@/lib/cache'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface DigestItem {
  headline: string   // 一句话结论，如"科技板块情绪升温"
  body: string       // 2-3 句背景/驱动
  sectors: string[]  // 涉及板块 ID
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface DigestResult {
  items: DigestItem[]
  generatedAt: string
  source: 'ai' | 'unavailable'
  sectors?: string[]   // 本次摘要涵盖的板块（用于个性化）
}

// ── 生成今日要点（按板块过滤） ────────────────────────────────────────────────
async function generateDigest(sectors?: string[]): Promise<DigestResult> {
  const key = process.env.DEEPSEEK_API_KEY
  const now = new Date().toISOString()

  if (!key) {
    return { items: [], generatedAt: now, source: 'unavailable' }
  }

  // 取最近 6h 的文章，最多 80 篇（按板块过滤）
  const targetSectors = sectors?.length ? sectors : undefined
  const allNews = await getArticlesForSector(targetSectors?.[0] ?? 'all', 6)

  // 多板块：合并各板块文章
  let articles = allNews
  if (targetSectors && targetSectors.length > 1) {
    const extras = await Promise.all(
      targetSectors.slice(1).map(s => getArticlesForSector(s, 6))
    )
    const seen = new Set(allNews.map(a => a.url))
    for (const list of extras) {
      for (const a of list) {
        if (!seen.has(a.url)) { seen.add(a.url); articles.push(a) }
      }
    }
  }

  if (articles.length === 0) {
    return { items: [], generatedAt: now, source: 'unavailable' }
  }

  // 按发布时间倒排，截取最近 60 篇
  articles = articles
    .sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime())
    .slice(0, 60)

  const titlesBlock = articles
    .map((a, i) => `${i + 1}. [${a.source || ''}] ${a.title}`)
    .join('\n')

  const prompt = `你是一名专业的卖方研究助理。以下是过去 6 小时内的财经新闻标题列表。

请从中提炼出最值得关注的 3 件事，每件事包含：
- headline：一句话核心结论（15字以内，如"科技板块情绪升温，AI算力需求超预期"）
- body：2-3 句背景说明，解释为什么重要、对市场有何影响
- sectors：涉及的板块 ID，从以下选择：macro finance realestate energy newenergy metals chemicals semiconductor ai auto pharma food consumer media telecom defense shipping logistics environment agriculture
- sentiment：positive / negative / neutral

**只返回 JSON 数组，不要任何其他内容：**
[
  {"headline":"...","body":"...","sectors":["..."],"sentiment":"positive"},
  ...
]

新闻列表：
${titlesBlock}`

  try {
    const res = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 800,
        stream: false,
      },
      {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    )

    const text: string = res.data?.choices?.[0]?.message?.content || '[]'
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('no json array in response')

    const raw = JSON.parse(match[0]) as DigestItem[]
    const items = raw
      .filter(i => i.headline && i.body)
      .slice(0, 3)

    return { items, generatedAt: now, source: 'ai', sectors: targetSectors }
  } catch (err) {
    console.error('[digest] DeepSeek failed:', err)
    return { items: [], generatedAt: now, source: 'unavailable' }
  }
}

export async function GET(req: NextRequest) {
  const sectorsParam = req.nextUrl.searchParams.get('sectors')
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'
  const sectors = sectorsParam ? sectorsParam.split(',').filter(Boolean) : undefined

  // 缓存 key 按板块组合区分；默认全局摘要缓存 60 分钟
  const cacheKey = `digest:${sectors?.sort().join(',') ?? 'all'}`
  const result = await cached(cacheKey, () => generateDigest(sectors), {
    ttl: 60 * 60 * 1000,
    fresh,
  })

  return NextResponse.json(result)
}
