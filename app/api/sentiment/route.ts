import { NextRequest, NextResponse } from 'next/server'
import { SECTORS } from '@/lib/news'
import { getArticlesForSector } from '@/lib/news'
import { analyzeSectorSentiment, analyzeSectorsBatch } from '@/lib/gemini'
import { allSectorsFingerprint, getNewSince } from '@/lib/article-store'
import { cached } from '@/lib/cache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ANALYZE_SECTORS = SECTORS.filter(s => s.id !== 'all')

// 新增文章少于此数量时，不值得重跑 DeepSeek
const MIN_NEW_ARTICLES_TO_REANALYZE = 10

/** 是否在 A 股交易时段（北京时间 09:00–15:30，周一至周五） */
function isMarketHours(): boolean {
  const cst = new Date(Date.now() + 8 * 3600_000)   // 换算到 UTC+8
  const day = cst.getUTCDay()                         // 0=日, 6=六
  const mins = cst.getUTCHours() * 60 + cst.getUTCMinutes()
  return day >= 1 && day <= 5 && mins >= 9 * 60 && mins <= 15 * 60 + 30
}

interface SectorSentiment {
  id: string
  name: string
  newsCount: number
  score: number
  label: string
  confidence: string
  summary: string
  drivers: string[]
  topNews: { title: string; url: string; source: string; pubDate: string }[]
}

// ── 进程级三层守门缓存 ─────────────────────────────────────────────────────────
// 层 1：指纹完全相同                → 直接复用
// 层 2：新文章 < 10 篇             → 变化太小，不值得重分析
// 层 3：市场时段外（收盘/周末）    → 缓存延长到 12h
let lastFingerprint = ''
let lastSentimentResult: SectorSentiment[] | null = null
let lastSentimentTime = 0

// ── 单板块（细粒度查询，仍用单调用 + 短 TTL 缓存） ────────────────────────────
async function analyzeOneCached(sec: { id: string; name: string }): Promise<SectorSentiment> {
  return cached(`sentiment:${sec.id}`, async () => {
    const news = await getArticlesForSector(sec.id)
    const top = news.slice(0, 12)
    const sentiment = await analyzeSectorSentiment(
      sec.name,
      top.map(n => ({ title: n.title, content: n.content || '' })),
    )
    if (!sentiment.summary || sentiment.summary === 'AI解析失败') throw new Error('parse_failed')
    return {
      id: sec.id, name: sec.name, newsCount: news.length, ...sentiment,
      topNews: top.slice(0, 5).map(n => ({
        title: n.title, url: n.url, source: n.source || '', pubDate: n.pubDate || '',
      })),
    }
  }, { ttl: 30 * 60 * 1000 })
}

// ── 全板块批量：指纹驱动，无新文章则复用上次结果 ──────────────────────────────
async function analyzeAllBatched(): Promise<SectorSentiment[]> {
  // 1. 预热 article store
  await getArticlesForSector('all', 24)

  const fingerprint = allSectorsFingerprint(ANALYZE_SECTORS.map(s => s.id))
  const now = Date.now()
  // 交易时段内最长缓存 4h；收盘/周末延长到 12h（市场关闭了情绪不会变）
  const maxAge = isMarketHours() ? 4 * 3600_000 : 12 * 3600_000

  // 2. 三层守门：满足任一条件 → 复用上次结果，不调 DeepSeek
  if (lastSentimentResult !== null && now - lastSentimentTime < maxAge) {
    const newCount = getNewSince(lastSentimentTime).length
    if (fingerprint === lastFingerprint) {
      console.log('[sentiment] skip: fingerprint unchanged')
      return lastSentimentResult
    }
    if (newCount < MIN_NEW_ARTICLES_TO_REANALYZE) {
      console.log(`[sentiment] skip: only ${newCount} new articles (< ${MIN_NEW_ARTICLES_TO_REANALYZE})`)
      return lastSentimentResult
    }
    if (!isMarketHours()) {
      console.log('[sentiment] skip: market closed, using cached result')
      return lastSentimentResult
    }
  }

  // 4. 从 store 读取各板块最近 24h 文章（已预热，直接读 store，无额外 HTTP）
  const newsPerSector = await Promise.all(
    ANALYZE_SECTORS.map(async sec => {
      const news = await getArticlesForSector(sec.id, 24)
      return { sec, news, top: news.slice(0, 8) }  // 最多 8 篇送给 DeepSeek
    })
  )

  // 5. 单次 DeepSeek 批量调用
  const batchInput = newsPerSector.map(({ sec, top }) => ({
    id: sec.id,
    name: sec.name,
    articles: top.map(n => ({ title: n.title, content: n.content || '' })),
  }))
  let sentiments: Awaited<ReturnType<typeof analyzeSectorsBatch>> = {}
  try {
    sentiments = await analyzeSectorsBatch(batchInput)
  } catch (err) {
    console.error('[sentiment] batch failed:', err)
    // 如果有上次结果，退回上次（不让页面空白）
    if (lastSentimentResult) return lastSentimentResult
  }

  // 6. 组装结果
  let anyFailed = false
  const results: SectorSentiment[] = newsPerSector.map(({ sec, news, top }) => {
    const s = sentiments[sec.id]
    if (!s) {
      anyFailed = true
      return {
        id: sec.id, name: sec.name, newsCount: news.length,
        score: 0, label: '中性', confidence: 'low',
        summary: 'AI 调用失败，请刷新重试', drivers: [],
        topNews: top.slice(0, 5).map(n => ({
          title: n.title, url: n.url, source: n.source || '', pubDate: n.pubDate || '',
        })),
      }
    }
    return {
      id: sec.id, name: sec.name, newsCount: news.length,
      score: s.score, label: s.label, confidence: s.confidence,
      summary: s.summary, drivers: s.drivers,
      topNews: top.slice(0, 5).map(n => ({
        title: n.title, url: n.url, source: n.source || '', pubDate: n.pubDate || '',
      })),
    }
  })

  results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

  // 7. 成功时更新指纹 & 缓存
  if (!anyFailed) {
    lastFingerprint = fingerprint
    lastSentimentResult = results
    lastSentimentTime = now
  } else if (anyFailed) {
    // 部分失败：保存指纹避免立刻重试，但不更新完整结果
    throw Object.assign(new Error('partial_failure'), { results })
  }

  return results
}

export async function GET(req: NextRequest) {
  const sector = req.nextUrl.searchParams.get('sector')

  try {
    if (sector && sector !== 'all') {
      const sec = ANALYZE_SECTORS.find(s => s.id === sector)
      if (!sec) return NextResponse.json({ error: 'unknown sector' }, { status: 400 })
      const result = await analyzeOneCached(sec)
      return NextResponse.json({ sector: result, generatedAt: new Date().toISOString() })
    }

    try {
      const results = await analyzeAllBatched()
      return NextResponse.json({ sectors: results, generatedAt: new Date().toISOString() })
    } catch (e) {
      const results = (e as { results?: SectorSentiment[] }).results
      if (results) {
        return NextResponse.json({
          sectors: results, generatedAt: new Date().toISOString(), partial: true,
        })
      }
      throw e
    }
  } catch (err) {
    console.error('[sentiment]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
