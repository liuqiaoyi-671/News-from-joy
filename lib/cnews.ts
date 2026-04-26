import axios from 'axios'
import Parser from 'rss-parser'

const parser = new Parser({ timeout: 6000 })

export interface CNewsItem {
  title: string
  content: string
  url: string
  pubDate: string
  source: string
  lang: 'zh'
  sourceCount?: number  // 同一事件在多少个来源被报道（用于判断重大新闻）
}

// ─── 新浪财经 JSON API ─────────────────────────────────────────────────────────
// pageid=153 是财经频道，lid 区分子栏目
// 每个分类取多页以获得更多行业覆盖
const SINA_CATEGORIES = [
  { lid: 2516, pages: 3, label: '新浪财经·要闻' },
  { lid: 152,  pages: 2, label: '新浪财经·股市' },
  { lid: 1750, pages: 2, label: '新浪财经·国际' },
  { lid: 2514, pages: 2, label: '新浪财经·宏观' },
  { lid: 2515, pages: 5, label: '新浪财经·行业' },  // 行业新闻多拉几页保证覆盖
]

async function fetchSinaCategory(lid: number, page: number, label: string): Promise<CNewsItem[]> {
  const res = await axios.get('https://feed.mix.sina.com.cn/api/roll/get', {
    params: { pageid: 153, lid, k: '', num: 30, page, r: Math.random() },
    headers: { Referer: 'https://finance.sina.com.cn/', 'User-Agent': 'Mozilla/5.0' },
    timeout: 5000,
  })
  return ((res.data?.result?.data || []) as Record<string, string>[])
    .map(item => ({
      title: item.title || '',
      content: item.intro || item.summary || '',
      url: item.url || item.wapurl || '',
      pubDate: item.ctime || item.mtime || '',
      source: label,
      lang: 'zh' as const,
    }))
    .filter(i => i.title && i.url)
}

// ─── 东方财富 JSON API ─────────────────────────────────────────────────────────
const EASTMONEY_CATEGORIES = [
  { source: 'WAPTOUTIAO', label: '东方财富·头条' },
  { source: 'WAPSTOCK',   label: '东方财富·股票' },
]

async function fetchEastmoneyCategory(source: string, label: string): Promise<CNewsItem[]> {
  const res = await axios.get('https://np-listapi.eastmoney.com/comm/wap/getListInfo', {
    params: { type: 1, source, client: 'wap', pageSize: 20, order: 1 },
    headers: { Referer: 'https://finance.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' },
    timeout: 5000,
  })
  return ((res.data?.data?.list || []) as Record<string, string>[])
    .map(item => ({
      title: item.title || item.Title || '',
      content: item.digest || item.Digest || '',
      url: item.url || item.NewsUrl || `https://finance.eastmoney.com/a/${item.id}.html`,
      pubDate: item.showTime || item.CreateTime || '',
      source: label,
      lang: 'zh' as const,
    }))
    .filter(i => i.title && i.url)
}

// ─── 财联社实时电报（翻页拉取更多） ────────────────────────────────────────
async function fetchCLSPage(lastTime?: number): Promise<{ items: CNewsItem[]; oldest: number }> {
  try {
    const params: Record<string, string | number> = { app: 'CLS', os: 'web', sv: '7.7.5', rn: 50 }
    if (lastTime) params.last_time = lastTime
    const res = await axios.get('https://www.cls.cn/nodeapi/telegraphs', {
      params,
      headers: { Referer: 'https://www.cls.cn/', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 6000,
    })
    const raw: Record<string, unknown>[] = res.data?.data?.roll_data || res.data?.data?.items || []
    const items = raw.map(item => ({
      title: String(item.brief || item.content || '').slice(0, 80),
      content: String(item.content || '').slice(0, 200),
      url: String(item.share_url || 'https://www.cls.cn/telegraph'),
      pubDate: String(item.ctime || ''),
      source: '财联社',
      lang: 'zh' as const,
    })).filter(i => i.title && i.title.length > 4)
    const oldest = raw.length ? Number(raw[raw.length - 1].ctime) || 0 : 0
    return { items, oldest }
  } catch { return { items: [], oldest: 0 } }
}

async function fetchCLS(): Promise<CNewsItem[]> {
  const page1 = await fetchCLSPage()
  if (!page1.oldest || page1.items.length < 30) return page1.items
  const page2 = await fetchCLSPage(page1.oldest)
  return [...page1.items, ...page2.items]
}

// ─── 东方财富 搜索 API — 按关键词拉取行业相关资讯 ──────────────────────────
// 覆盖新浪/界面/36氪/同花顺/百家号/官方等多源聚合；为"稀缺行业"保障底量
// 也作为用户关键词搜索的全网检索后端
export async function fetchEastmoneySearch(keyword: string, pageSize = 20): Promise<CNewsItem[]> {
  try {
    const paramObj = {
      uid: '', keyword,
      type: ['cmsArticleWebOld'],
      client: 'web', clientType: 'web', clientVersion: 'curr',
      param: { cmsArticleWebOld: { searchScope: 'default', sort: 'time', pageIndex: 1, pageSize } },
    }
    const res = await axios.get('https://search-api-web.eastmoney.com/search/jsonp', {
      params: { cb: 'c', param: JSON.stringify(paramObj) },
      headers: { Referer: 'https://so.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' },
      timeout: 6000,
      transformResponse: [(data: string) => data],  // 保留 JSONP 原文
    })
    const text: string = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    const m = text.match(/c\(([\s\S]*)\)/)
    if (!m) return []
    const parsed = JSON.parse(m[1])
    const list: Record<string, string>[] = parsed?.result?.cmsArticleWebOld || []
    return list.map(item => ({
      title: (item.title || '').replace(/<\/?em>/g, ''),
      content: (item.content || '').replace(/<\/?em>/g, '').slice(0, 200),
      url: item.url || '',
      pubDate: item.date || '',
      source: `东财·${item.mediaName || '综合'}`,
      lang: 'zh' as const,
    })).filter(i => i.title && i.url)
  } catch { return [] }
}

// ─── 新浪关键词搜索 ──────────────────────────────────────────────────────
export async function fetchSinaSearch(keyword: string, num = 20): Promise<CNewsItem[]> {
  try {
    const res = await axios.get('https://interface.sina.cn/homepage/search.d.json', {
      params: { q: keyword, num, col: '1_7' },
      headers: { Referer: 'https://search.sina.com.cn/', 'User-Agent': 'Mozilla/5.0' },
      timeout: 6000,
    })
    const list: Record<string, string>[] = res.data?.result?.list || []
    return list.map(item => ({
      title: (item.title || item.origin_title || '').replace(/<\/?font[^>]*>/g, ''),
      content: (item.intro || '').replace(/<\/?font[^>]*>/g, '').slice(0, 200),
      url: item.url || '',
      pubDate: item.stime || item.create_date || '',
      source: `新浪·${item.media || '搜索'}`,
      lang: 'zh' as const,
    })).filter(i => i.title && i.url)
  } catch { return [] }
}

// ─── 关键词搜索 — 全网聚合（用户查询入口）────────────────────────────────
export async function searchByKeyword(keyword: string): Promise<CNewsItem[]> {
  if (!keyword.trim()) return []
  const [em, sina] = await Promise.allSettled([
    fetchEastmoneySearch(keyword, 30),
    fetchSinaSearch(keyword, 20),
  ])
  const all: CNewsItem[] = []
  if (em.status === 'fulfilled') all.push(...em.value)
  if (sina.status === 'fulfilled') all.push(...sina.value)
  // URL 去重
  const seen = new Set<string>()
  return all.filter(i => {
    if (!i.url || seen.has(i.url)) return false
    seen.add(i.url)
    return true
  })
}

// 每个行业 1-2 个高区分度关键词 — 确保跨行业均衡覆盖
const EASTMONEY_SEARCH_KEYWORDS = [
  // 宏观/金融
  '央行', '美联储', '降准降息', '银行股',
  // 地产/建筑（重点加强）
  '房地产', '楼市', '地产政策', '物业管理',
  // 能源
  '原油', '煤炭', '天然气',
  // 新能源
  '光伏', '锂电池', '储能',
  // 农业
  '生猪', '大豆',
  // 食品
  '白酒', '食品饮料',
  // 化工/金属
  '化工行业', '钢铁', '有色金属',
  // 医药
  '创新药', '医疗器械',
  // 科技
  '人工智能', '大模型', '半导体', '芯片', '信创',
  // 汽车
  '新能源车', '智能驾驶',
  // 消费/军工/通信/机械/环保/交通
  '消费电子', '军工', '5G', '工程机械', '环保', '航运',
]

// ─── RSS 源解析 ────────────────────────────────────────────────────────────────
async function fetchRssZH(url: string, label: string, limit = 20): Promise<CNewsItem[]> {
  try {
    const feed = await parser.parseURL(url)
    return (feed.items || []).slice(0, limit).map(item => ({
      title: item.title || '',
      content: item.contentSnippet || item.summary || '',
      url: item.link || '',
      pubDate: item.pubDate || item.isoDate || '',
      source: label,
      lang: 'zh' as const,
    })).filter(i => i.title && i.url)
  } catch { return [] }
}

// ⚠️ 已移除失效源：证券时报 RSS（官网404，内容已由"东财搜索·证券时报e公司"覆盖）
const ZH_RSS_SOURCES = [
  { url: 'https://www.yicai.com/rss/news.xml',                          label: '第一财经' },
  { url: 'https://wallstreetcn.com/rss',                                label: '华尔街见闻' },
  { url: 'https://36kr.com/feed',                                       label: '36氪' },
  { url: 'https://www.huxiu.com/rss/0.xml',                            label: '虎嗅' },
  { url: 'https://www.tmtpost.com/feed',                                label: '钛媒体' },
  { url: 'https://a.jiemian.com/index.php?m=article&a=rss',           label: '界面新闻' },
  { url: 'http://rss.sina.com.cn/finance/future.xml',                  label: '新浪·期货' },
]

// ─── 主入口 ───────────────────────────────────────────────────────────────────
export async function fetchChineseNews(): Promise<CNewsItem[]> {
  const tasks: Promise<CNewsItem[]>[] = [
    // 新浪财经主分类 — 多页拉取以保证行业覆盖
    ...SINA_CATEGORIES.flatMap(c =>
      Array.from({ length: c.pages }, (_, i) => fetchSinaCategory(c.lid, i + 1, c.label))
    ),
    // 东方财富
    ...EASTMONEY_CATEGORIES.map(c => fetchEastmoneyCategory(c.source, c.label)),
    // 财联社电报
    fetchCLS(),
    // 东财关键词搜索（按行业关键词并发拉取，保障稀缺行业覆盖）
    ...EASTMONEY_SEARCH_KEYWORDS.map(kw => fetchEastmoneySearch(kw)),
    // RSS 来源
    ...ZH_RSS_SOURCES.map(s => fetchRssZH(s.url, s.label)),
  ]

  const results = await Promise.allSettled(tasks)
  const all: CNewsItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  // ── 第一轮去重：标题前缀完全相同 ────────────────────────────────────────────
  const seen = new Set<string>()
  const dedup1 = all.filter(item => {
    const key = item.title.slice(0, 20)
    if (seen.has(key)) return false
    seen.add(key)
    return Boolean(item.title)
  })

  // ── 时间排序 ──────────────────────────────────────────────────────────────
  dedup1.sort((a, b) => {
    const ta = new Date(a.pubDate.replace(' ', 'T')).getTime() || 0
    const tb = new Date(b.pubDate.replace(' ', 'T')).getTime() || 0
    return tb - ta
  })

  // ── 第二轮去重：中文二元字符 bigram 相似度 ────────────────────────────────
  // 若两篇文章标题的 bigram Jaccard 相似度 > 0.45，视为同一事件，只保留最新那篇
  function bigrams(s: string): Set<string> {
    const clean = s.replace(/\s+/g, '').slice(0, 40)  // 只比较前40字
    const bg = new Set<string>()
    for (let i = 0; i < clean.length - 1; i++) bg.add(clean.slice(i, i + 2))
    return bg
  }
  function jaccardSim(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0
    let inter = 0
    for (const g of a) if (b.has(g)) inter++
    return inter / (a.size + b.size - inter)
  }

  // 同事件去重，同时记录每组事件的跨源数量（用于判断"重大新闻"）
  const kept: CNewsItem[] = []
  const keptBigrams: Set<string>[] = []
  const eventSources: Set<string>[] = []  // 每组事件出现过的 source 集合
  const eventIndex = new Map<CNewsItem, number>()  // item → 它所属事件组的索引

  for (const item of dedup1) {
    const bg = bigrams(item.title)
    let matched = -1
    for (let i = 0; i < keptBigrams.length; i++) {
      if (jaccardSim(bg, keptBigrams[i]) > 0.45) { matched = i; break }
    }
    if (matched === -1) {
      kept.push(item)
      keptBigrams.push(bg)
      eventSources.push(new Set([item.source]))
      eventIndex.set(item, keptBigrams.length - 1)
    } else {
      // 同事件 — 不保留该条，但计入跨源数量
      eventSources[matched].add(item.source)
    }
  }

  // 给 kept 里的每条打上 sourceCount 属性（用于下游判断重大新闻）
  for (const item of kept) {
    const idx = eventIndex.get(item)
    if (idx !== undefined) {
      ;(item as CNewsItem & { sourceCount?: number }).sourceCount = eventSources[idx].size
    }
  }

  return kept.slice(0, 400)  // 扩大到 400，配合下游时间过滤
}
