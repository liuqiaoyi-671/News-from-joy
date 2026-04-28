/**
 * 进程级文章去重存储
 *
 * 设计目标：
 * 1. 同一篇文章（相同 URL）只存一次，避免重复分析
 * 2. 为情绪分析提供"指纹"——板块内文章列表没变就不调 DeepSeek
 * 3. 自动剪枝 36h 前的旧文章
 *
 * 生命周期：跟随 Node.js 进程（dev server 重启后重建，Vercel Lambda 冷启动后重建）
 */

export interface StoredArticle {
  title: string
  content: string
  url: string
  pubDate: string
  source: string
  sectors: string[]
  lang: 'zh' | 'en'
  translatedTitle?: string
  addedAt: number   // Date.now() when first added to store
}

// ── 主存储 ─────────────────────────────────────────────────────────────────────
const articleMap = new Map<string, StoredArticle>()
let lastPruneAt = Date.now()

const PRUNE_AFTER_MS = 36 * 3600 * 1000  // 36h 后剪枝
const PRUNE_INTERVAL_MS = 15 * 60 * 1000 // 每 15 min 检查一次

// ── 写入 ───────────────────────────────────────────────────────────────────────

/**
 * 批量合并文章，返回真正新增的数量。
 * 已存在 URL 的文章会被忽略（dedup）。
 */
export function mergeArticles(
  items: Omit<StoredArticle, 'addedAt'>[]
): { added: number; total: number } {
  const now = Date.now()
  let added = 0
  for (const item of items) {
    if (!item.url || articleMap.has(item.url)) continue
    articleMap.set(item.url, { ...item, addedAt: now })
    added++
  }
  maybePrune(now)
  return { added, total: articleMap.size }
}

// ── 读取 ───────────────────────────────────────────────────────────────────────

/** 获取文章列表，按发布时间倒序排列。maxAgeHours 限制最老文章年龄（不传则不限制）。 */
export function getArticles(sector?: string, maxAgeHours?: number): StoredArticle[] {
  const all = Array.from(articleMap.values())
  const cutoff = maxAgeHours ? Date.now() - maxAgeHours * 3600 * 1000 : 0
  const filtered = all.filter(a => {
    if (sector && !a.sectors.includes(sector)) return false
    if (cutoff) {
      const t = toMs(a.pubDate) || a.addedAt
      if (t > 0 && t < cutoff) return false
    }
    return true
  })
  return filtered.sort((a, b) => compareDate(b.pubDate, a.pubDate))
}

/** 获取某时刻之后新增到 store 的文章（用于判断有没有新内容）。 */
export function getNewSince(ts: number, sector?: string): StoredArticle[] {
  return Array.from(articleMap.values()).filter(
    a => a.addedAt > ts && (!sector || a.sectors.includes(sector))
  )
}

/** 计算板块指纹：取最近 30 条文章 URL 拼成字符串，用于快速判断内容是否变化。 */
export function sectorFingerprint(sectorId: string): string {
  const urls = getArticles(sectorId)
    .slice(0, 30)
    .map(a => a.url)
    .join('|')
  return `${articleMap.size}:${urls.length}:${simpleHash(urls)}`
}

/** 全部板块指纹（拼接后哈希），用于判断是否需要整体重分析。 */
export function allSectorsFingerprint(sectorIds: string[]): string {
  return simpleHash(sectorIds.map(sectorFingerprint).join(';'))
}

export function storeSize() { return articleMap.size }

// ── 剪枝 ───────────────────────────────────────────────────────────────────────
function maybePrune(now: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return
  const cutoff = now - PRUNE_AFTER_MS
  for (const [url, a] of articleMap) {
    if (a.addedAt < cutoff) articleMap.delete(url)
  }
  lastPruneAt = now
}

// ── 工具 ───────────────────────────────────────────────────────────────────────
function compareDate(a: string, b: string): number {
  const ta = toMs(a), tb = toMs(b)
  return ta - tb
}
function toMs(s: string): number {
  if (!s) return 0
  const n = Number(s)
  if (!isNaN(n)) return n > 1e10 ? n : n * 1000
  return new Date(s.replace(' ', 'T')).getTime() || 0
}

/** djb2-style 简单哈希，返回 6 位 hex */
function simpleHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6)
}
