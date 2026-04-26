import Parser from 'rss-parser'
import axios from 'axios'
import { fetchChineseNews, searchByKeyword, type CNewsItem } from './cnews'

const parser = new Parser({ timeout: 5000 })

// ─── 申万行业 → 新闻分区映射 ──────────────────────────────────────────────────
// 覆盖全部31个申万一级行业，部分相近行业合并为一个分区
export const SECTORS = [
  { id: 'all',        name: '全部' },
  // ── 宏观/政策 ─────────────────────────────────────────────────────────────
  { id: 'macro',      name: '宏观/政策',  keywords: [
    'gdp', 'inflation', 'cpi', 'ppi', 'pmi', 'employment', 'recession', 'fed', 'fomc',
    'interest rate', 'federal reserve', 'tariff', 'trade war', 'geopolit',
    '通胀', '经济', '就业', '衰退', '贸易', '关税', '贸易战', 'pmi', '财政', '货币政策',
    '美联储', '降息', '加息', '央行', '汇率', '外贸', '进出口', '顺差', '逆差',
    '刺激', '政策', '国务院', '发改委', '财政部', '工信部',
  ]},
  // ── 金融：申万银行 + 非银金融 ────────────────────────────────────────────────
  { id: 'finance',    name: '金融',       keywords: [
    'bank', 'fed', 'credit', 'finance', 'insurance', 'securities', 'brokerage',
    '银行', '利率', '信贷', '保险', '券商', '证券', '基金', '资产管理', '信托',
    '存款', '贷款', '资金面', '流动性', '工行', '建行', '招商银行', '平安', '中信',
    '非银', '理财', '债市', '债券', '同业', '拆借',
  ]},
  // ── 房地产：申万房地产 + 建筑装饰 ───────────────────────────────────────────
  { id: 'realestate', name: '房地产/建筑', keywords: [
    'real estate', 'housing', 'property market', 'mortgage', 'reit',
    '房地产', '楼市', '房价', '地产', '住宅', '商业地产', '房产', '楼盘',
    '新房', '二手房', '商品房', '保障房', '房企', '开发商', '物业', '物管',
    '房贷', '首付', '公积金', '限购', '限售', '限贷', '土地出让', '拍地', '卖地',
    '碧桂园', '万科', '恒大', '融创', '保利', '中海地产', '龙湖', '华润置地',
    '城投', '棚改', '旧改', '基建投资', '基础设施建设', '建筑施工',
  ]},
  // ── 能源：申万石油石化 + 煤炭 ──────────────────────────────────────────────
  { id: 'energy',     name: '能源/煤炭',  keywords: [
    'oil', 'gas', 'energy', 'opec', 'crude', 'petroleum', 'lng', 'coal', 'refinery',
    '石油', '能源', '天然气', '原油', '煤炭', '焦炭', '动力煤', '焦煤', 'opec',
    '中石化', '中石油', '中海油', '成品油', '炼化', '石化',
    '坑口价', '煤价', '进口煤',
  ]},
  // ── 新能源：申万电气设备（光伏/风电/储能）────────────────────────────────────
  { id: 'newenergy',  name: '新能源',     keywords: [
    'solar', 'wind', 'battery', 'lithium', 'renewable', 'photovoltaic', 'energy storage',
    '光伏', '风电', '储能', '锂', '新能源', '碳中和', '绿电', '氢能', '风机',
    '宁德时代', '比亚迪储能', '阳光电源', '隆基', '通威', '晶科',
    '碳酸锂', '磷酸铁锂', '三元', '电池', '充电桩',
  ]},
  // ── 农林牧渔 ──────────────────────────────────────────────────────────────
  { id: 'agriculture',name: '农林牧渔',   keywords: [
    'agriculture', 'farm', 'crop', 'grain', 'wheat', 'corn', 'soybean', 'livestock',
    'hog', 'cattle', 'poultry', 'fishery', 'feed',
    '农业', '粮食', '大豆', '小麦', '玉米', '生猪', '猪价', '豆粕', '棉花',
    '农产品', '种植', '养殖', '饲料', '畜牧', '渔业', '林业', '水产',
    '猪周期', '豆油', '玉米淀粉', '禽流感', '非洲猪瘟',
  ]},
  // ── 食品饮料 ──────────────────────────────────────────────────────────────
  { id: 'food',       name: '食品饮料',   keywords: [
    'food', 'beverage', 'alcohol', 'beer', 'dairy', 'restaurant', 'liquor',
    '食品', '饮料', '白酒', '啤酒', '乳制品', '调味品', '速食', '烘焙',
    '茅台', '五粮液', '泸州老窖', '洋河', '青岛啤酒', '海天味业', '伊利', '蒙牛',
    '餐饮', '消费升级', '食品安全', '进口食品',
  ]},
  // ── 化工 ──────────────────────────────────────────────────────────────────
  { id: 'chemicals',  name: '化工',       keywords: [
    'chemical', 'polymer', 'fertilizer', 'pesticide', 'plastic', 'rubber',
    '化工', '化肥', '农药', '塑料', '橡胶', '纯碱', '烧碱', 'MDI', 'PTA',
    '丙烯', '乙烯', '甲醇', '合成树脂', '涂料', '油漆', '丁二烯',
    '化工品', '石化产品', '煤化工', '精细化工',
  ]},
  // ── 钢铁 + 有色金属 ───────────────────────────────────────────────────────
  { id: 'metals',     name: '钢铁/有色',  keywords: [
    'steel', 'iron ore', 'copper', 'aluminum', 'zinc', 'nickel', 'metal', 'mining',
    '钢铁', '钢价', '螺纹钢', '热轧', '铁矿石', '生铁', '粗钢', '废钢',
    '有色金属', '铜', '铝', '锌', '铅', '镍', '锡', '钴', '锂',
    '宝钢', '鞍钢', '华菱', '紫金矿业', '洛阳钼业', '铜陵有色',
  ]},
  // ── 医药生物 ──────────────────────────────────────────────────────────────
  { id: 'pharma',     name: '医药生物',   keywords: [
    'pharma', 'drug', 'biotech', 'fda', 'clinical', 'medicine', 'vaccine', 'medical device',
    '医药', '生物技术', '医疗', '创新药', '集采', 'CXO', '疫苗', '器械', '原料药',
    '恒瑞医药', '迈瑞医疗', '药明康德', '百济神州', '信达生物',
    '医保', '带量采购', 'IVD', '基因检测', '细胞治疗',
  ]},
  // ── AI & 计算机（申万计算机）─────────────────────────────────────────────────
  { id: 'ai',         name: 'AI & 科技',  keywords: [
    'artificial intelligence', 'machine learning', 'chatgpt', 'llm', 'generative ai',
    'cloud', 'software', 'saas', 'data center', 'cybersecurity',
    '人工智能', '大模型', '算力', '数据中心', '云计算', '软件', '信息安全',
    '互联网', 'DeepSeek', '华为昇腾', '阿里云', '腾讯云', '百度AI',
    '计算机', '国产替代', '信创', '数字经济', '元宇宙',
  ]},
  // ── 半导体/电子（申万电子）──────────────────────────────────────────────────
  { id: 'semiconductor', name: '半导体/电子', keywords: [
    'semiconductor', 'chip', 'fab', 'tsmc', 'nvidia', 'wafer', 'pcb', 'display',
    'led', 'memory', 'nand', 'dram',
    '半导体', '芯片', '集成电路', '晶圆', '封装', '测试', '光刻机',
    '台积电', '中芯国际', '华虹', '北方华创', '中微公司',
    'PCB', '面板', 'OLED', 'LED', '消费电子', '苹果供应链',
  ]},
  // ── 汽车 ──────────────────────────────────────────────────────────────────
  { id: 'auto',       name: '汽车',       keywords: [
    'auto', 'car', 'ev', 'electric vehicle', 'tesla', 'byd', 'autonomous driving',
    '汽车', '新能源车', '电动车', '燃油车', '智能驾驶', '车企',
    '比亚迪', '特斯拉', '理想', '小鹏', '蔚来', '问界', '小米汽车',
    '销量', '交付', '产能', '车规芯片',
  ]},
  // ── 消费：申万家用电器 + 纺织服装 + 商业贸易 + 休闲服务 ──────────────────────
  { id: 'consumer',   name: '消费/零售',  keywords: [
    'retail', 'consumer', 'home appliance', 'fashion', 'ecommerce', 'luxury',
    'travel', 'hotel', 'catering',
    '消费', '零售', '家电', '服装', '品牌', '电商', '直播带货', '免税',
    '旅游', '酒店', '餐饮', '出行', '文旅', '影视', '游戏', '娱乐',
    '美的', '格力', '海尔', '小米', '九阳',
  ]},
  // ── 军工（申万国防军工）───────────────────────────────────────────────────────
  { id: 'defense',    name: '军工/航天',  keywords: [
    'defense', 'military', 'aerospace', 'aviation', 'missile', 'weapon',
    '军工', '国防', '航天', '航空', '武器', '舰船', '雷达', '导弹',
    '军费', '军备', '中航', '航发动力', '中国船舶',
    '卫星', '北斗', '商业航天', '火箭',
  ]},
  // ── 通信（申万通信）+ 传媒（申万传媒）─────────────────────────────────────────
  { id: 'telecom',    name: '通信/传媒',  keywords: [
    'telecom', '5g', '6g', 'broadband', 'wireless', 'satellite', 'media', 'streaming',
    '通信', '5G', '基站', '运营商', '电信', '移动', '联通', '华为', '中兴',
    '传媒', '媒体', '广告', '出版', '影视', '网络视频', '游戏', '文化',
    '流量', '频谱', '物联网', 'IoT',
  ]},
  // ── 机械设备（申万机械设备）+ 建筑材料 ──────────────────────────────────────
  { id: 'machinery',  name: '机械/制造',  keywords: [
    'machinery', 'equipment', 'robot', 'automation', 'cnc', 'crane', 'excavator',
    '机械', '设备', '工程机械', '数控', '机器人', '自动化', '挖掘机', '工业母机',
    '三一重工', '中联重科', '徐工', '上工申贝',
    '建材', '水泥', '玻璃', '陶瓷', '海螺水泥', '东方雨虹',
  ]},
  // ── 环保（申万环保）+ 公用事业（申万公用事业）────────────────────────────────
  { id: 'environment',name: '环保/公用',  keywords: [
    'environment', 'pollution', 'carbon', 'emission', 'waste', 'water treatment',
    'power utility', 'electricity', 'nuclear power', 'hydro',
    '环保', '污水处理', '垃圾处理', '大气治理', '固废', '碳交易', '碳中和',
    '公用事业', '电力', '水务', '燃气', '电网', '火电', '核电', '水电',
    '华能', '大唐', '国电投',
  ]},
  // ── 交通运输（申万交通运输）──────────────────────────────────────────────────
  { id: 'transport',  name: '交通运输',   keywords: [
    'logistics', 'shipping', 'aviation', 'railway', 'port', 'freight', 'express',
    '交通', '运输', '物流', '航运', '航空', '铁路', '高铁', '港口', '快递',
    '中远海控', '中集', '顺丰', '圆通', '韵达', '国航', '东航', '南航',
    '集运', '干散货', 'BDI', '波罗的海',
  ]},
]

export interface NewsItem {
  title: string
  content: string
  url: string
  pubDate: string
  source: string
  sectors: string[]
  lang: 'zh' | 'en'
  translatedTitle?: string
  sourceCount?: number  // 同事件跨源报道数
}

// ─── 时间解析 & 重大新闻判定 ──────────────────────────────────────────────
function parsePubDate(s: string): number {
  if (!s) return 0
  // 已是数字（unix 秒或毫秒）
  const num = Number(s)
  if (!isNaN(num) && num > 0) return num > 1e11 ? num : num * 1000
  // 先直接解析（RFC822 / ISO 直接通过）
  let t = new Date(s).getTime()
  if (!isNaN(t)) return t
  // "YYYY-MM-DD HH:MM:SS [+0800]" 格式：第一个空格替换为 T，其余空格规范化
  const cleaned = s.trim().replace(/\s+/g, ' ').replace(' ', 'T').replace(' ', '')
  t = new Date(cleaned).getTime()
  return isNaN(t) ? 0 : t
}

// 重大新闻关键词（无视行业、无视时间，命中即认为值得破例保留）
const MAJOR_KEYWORDS = [
  // 宏观
  '降息', '加息', '降准', '升准', '逆回购', 'LPR', '央行', '美联储', 'FOMC', 'Fed rate',
  '国务院', '政治局', '中央经济工作会议', '两会', '总理', '主席',
  // 重大事件
  '重磅', '突发', '重大', '历史新高', '历史新低', '暴跌', '暴涨', '熔断', '停牌',
  '破产', '违约', '制裁', '战争', '地震', '黑天鹅', '危机', '崩盘',
  // 企业/行业
  'IPO', '退市', '收购', '并购', '重组', '破发', '巨亏', '暴雷',
  '新规', '监管', '处罚', '罚款', '调查',
  // 数据/政策
  '超预期', '不及预期', '创新高', '创新低', 'GDP', 'CPI', 'PPI', 'PMI',
  // 英文对应
  'emergency', 'crisis', 'collapse', 'bankruptcy', 'sanction',
  'record high', 'record low', 'interest rate cut', 'rate hike',
]

function isMajorNews(item: NewsItem): boolean {
  // 多源报道（≥2 个来源讲同一事件）→ 直接判定为重大
  if ((item.sourceCount || 1) >= 2) return true
  const text = (item.title + ' ' + item.content).toLowerCase()
  return MAJOR_KEYWORDS.some(kw => text.includes(kw.toLowerCase()))
}

// 过去 72h 全保留；3-7 天只保留重大；>7 天丢弃；pubDate 无法解析的也保留（保守策略）
function filterByRecency(items: NewsItem[]): NewsItem[] {
  const now = Date.now()
  const H72 = 72 * 3600 * 1000
  const D7 = 7 * 24 * 3600 * 1000
  return items.filter(item => {
    const t = parsePubDate(item.pubDate)
    if (!t) return true  // 日期不可解析 → 保留（避免误删）
    const age = now - t
    if (age < 0) return true  // 未来时间（服务器时区异常）→ 保留
    if (age <= H72) return true
    if (age <= D7) return isMajorNews(item)
    return false  // 超过 7 天 → 丢弃
  })
}

export function matchSectors(text: string): string[] {
  const lower = text.toLowerCase()
  return SECTORS
    .filter(s => s.id !== 'all' && s.keywords?.some(kw => lower.includes(kw.toLowerCase())))
    .map(s => s.id)
}

// ─── 英文 RSS：通用 ───────────────────────────────────────────────────────────
const EN_GENERAL_FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/businessNews',                             label: 'Reuters Business' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', label: 'CNBC Markets' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',         label: 'MarketWatch' },
  { url: 'https://finance.yahoo.com/news/rssindex',                                   label: 'Yahoo Finance' },
  { url: 'https://feeds.bloomberg.com/markets/news.rss',                              label: 'Bloomberg Markets' },
]

// ─── 英文 RSS：申万行业对应板块 ──────────────────────────────────────────────
const EN_SECTOR_FEEDS: Record<string, { url: string; label: string }[]> = {
  macro: [
    { url: 'https://feeds.reuters.com/Reuters/worldNews',                              label: 'Reuters World' },
    { url: 'https://feeds.reuters.com/reuters/politicsNews',                           label: 'Reuters Politics' },
  ],
  finance: [
    { url: 'https://feeds.reuters.com/reuters/financialsNews',                         label: 'Reuters Finance' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', label: 'CNBC Finance' },
  ],
  realestate: [
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',       label: 'MarketWatch' },
  ],
  energy: [
    { url: 'https://oilprice.com/rss/main',                                            label: 'OilPrice.com' },
    { url: 'https://feeds.reuters.com/reuters/energy',                                 label: 'Reuters Energy' },
  ],
  newenergy: [
    { url: 'https://cleantechnica.com/feed/',                                           label: 'CleanTechnica' },
    { url: 'https://electrek.co/feed/',                                                 label: 'Electrek' },
  ],
  agriculture: [
    { url: 'https://www.agweb.com/rss/news',                                            label: 'AgWeb' },
    { url: 'https://www.dtnpf.com/agriculture/web/ag/news/rss',                         label: 'DTN Agriculture' },
    { url: 'https://www.worldagriculturalprice.com/rss/news.xml',                        label: 'World Ag Prices' },
  ],
  food: [
    { url: 'https://www.foodnavigator.com/rss/news',                                    label: 'FoodNavigator' },
    { url: 'https://www.bevindustry.com/rss/topic/2639-beverages',                       label: 'Beverage Industry' },
  ],
  chemicals: [
    { url: 'https://www.chemweek.com/rss',                                              label: 'ChemWeek' },
    { url: 'https://feeds.reuters.com/reuters/energy',                                  label: 'Reuters Energy' },
  ],
  metals: [
    { url: 'https://www.mining.com/rss/',                                               label: 'Mining.com' },
    { url: 'https://feeds.reuters.com/reuters/metals',                                   label: 'Reuters Metals' },
  ],
  pharma: [
    { url: 'https://www.biopharmadive.com/feeds/news/',                                  label: 'BioPharma Dive' },
    { url: 'https://www.fiercepharma.com/rss/xml',                                       label: 'Fierce Pharma' },
    { url: 'https://www.medscape.com/rss/allnews.xml',                                   label: 'Medscape' },
  ],
  ai: [
    { url: 'https://venturebeat.com/category/ai/feed/',                                  label: 'VentureBeat AI' },
    { url: 'https://techcrunch.com/tag/artificial-intelligence/feed/',                   label: 'TechCrunch AI' },
    { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',          label: 'The Verge AI' },
  ],
  semiconductor: [
    { url: 'https://feeds.feedburner.com/AnandTech',                                     label: 'AnandTech' },
    { url: 'https://semianalysis.com/feed/',                                              label: 'SemiAnalysis' },
    { url: 'https://www.eetimes.com/feed/',                                               label: 'EE Times' },
  ],
  auto: [
    { url: 'https://feeds.feedburner.com/autonews/AllContent',                            label: 'Automotive News' },
    { url: 'https://electrek.co/tag/tesla/feed/',                                         label: 'Electrek Tesla' },
  ],
  consumer: [
    { url: 'https://feeds.reuters.com/reuters/consumergoodsNews',                         label: 'Reuters Consumer' },
  ],
  defense: [
    { url: 'https://www.defensenews.com/rss/all.rss/',                                    label: 'Defense News' },
    { url: 'https://aviationweek.com/rss.xml',                                             label: 'Aviation Week' },
  ],
  telecom: [
    { url: 'https://www.fiercewireless.com/rss/xml',                                       label: 'Fierce Wireless' },
    { url: 'https://www.lightreading.com/rss_simple.asp',                                  label: 'Light Reading' },
  ],
  machinery: [
    { url: 'https://www.themanufacturer.com/feed/',                                         label: 'The Manufacturer' },
  ],
  environment: [
    { url: 'https://cleantechnica.com/feed/',                                                label: 'CleanTechnica' },
    { url: 'https://feeds.reuters.com/reuters/environment',                                  label: 'Reuters Environment' },
  ],
  transport: [
    { url: 'https://feeds.reuters.com/reuters/transport',                                    label: 'Reuters Transport' },
    { url: 'https://theloadstar.com/feed/',                                                  label: 'The Loadstar' },
  ],
}

async function fetchRss(url: string, label: string): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(url)
    return (feed.items || []).slice(0, 15).map(item => ({
      title: item.title || '',
      content: item.contentSnippet || '',
      url: item.link || '',
      pubDate: item.pubDate || item.isoDate || '',
      source: label,
      sectors: matchSectors(`${item.title} ${item.contentSnippet}`),
      lang: 'en' as const,
    })).filter(i => i.title && i.url)
  } catch { return [] }
}

export async function translateTitles(items: NewsItem[]): Promise<NewsItem[]> {
  const key = process.env.GEMINI_API_KEY
  if (!key || key.startsWith('你的')) return items
  const enItems = items.filter(i => i.lang === 'en' && !i.translatedTitle)
  if (!enItems.length) return items
  try {
    const titles = enItems.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n')
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      { contents: [{ parts: [{ text: `翻译为中文财经标题，只返回JSON数组["译文1","译文2"]：\n${titles}` }] }] },
      { timeout: 20000 }
    )
    const text: string = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const match = text.match(/\[[\s\S]*?\]/)
    if (match) {
      const translated: string[] = JSON.parse(match[0])
      enItems.forEach((item, i) => { if (translated[i]) item.translatedTitle = translated[i] })
    }
  } catch { /* fallback */ }
  return items
}

// ─── 关键词搜索 — 本地资讯池过滤 + 全网检索合并 ──────────────────────────
export async function searchNews(query: string, translate = false): Promise<NewsItem[]> {
  const q = query.trim()
  if (!q) return []
  const qLower = q.toLowerCase()

  // 并发：本地资讯池过滤 + 全网检索
  const [localPool, freshFromWeb] = await Promise.all([
    fetchChineseNews(),
    searchByKeyword(q),
  ])

  // 合并并标注语言/板块/sourceCount
  const localMatched: NewsItem[] = (localPool as CNewsItem[])
    .filter(c => (c.title + ' ' + c.content).toLowerCase().includes(qLower))
    .map(c => ({ ...c, sectors: matchSectors(c.title + ' ' + c.content), lang: 'zh' as const }))

  const freshItems: NewsItem[] = freshFromWeb.map(c => ({
    ...c,
    sectors: matchSectors(c.title + ' ' + c.content),
    lang: 'zh' as const,
  }))

  // URL 去重（local 优先）
  const seen = new Set<string>()
  let all: NewsItem[] = []
  for (const item of [...localMatched, ...freshItems]) {
    if (!item.url || seen.has(item.url)) continue
    seen.add(item.url)
    all.push(item)
  }

  all.sort((a, b) => parsePubDate(b.pubDate) - parsePubDate(a.pubDate))
  all = filterByRecency(all)
  all = all.slice(0, 200)
  if (translate) all = await translateTitles(all)
  return all
}

export async function fetchNews(sectorFilter?: string, translate = false): Promise<NewsItem[]> {
  const enFeeds = [...EN_GENERAL_FEEDS]
  if (sectorFilter && sectorFilter !== 'all' && EN_SECTOR_FEEDS[sectorFilter]) {
    enFeeds.push(...EN_SECTOR_FEEDS[sectorFilter])
  }

  const [cnRaw, ...enResults] = await Promise.all([
    fetchChineseNews(),
    ...enFeeds.map(f => fetchRss(f.url, f.label)),
  ])

  const cnItems: NewsItem[] = (cnRaw as CNewsItem[]).map(c => ({
    ...c,
    sectors: matchSectors(c.title + ' ' + c.content),
    lang: 'zh' as const,
  }))

  const enItems: NewsItem[] = enResults.flat()

  let all = [...cnItems, ...enItems]
    .filter(i => i.title)
    .sort((a, b) => parsePubDate(b.pubDate) - parsePubDate(a.pubDate))

  // ── 时间过滤：72h 内全保留；3-7 天只保留重大；>7 天丢弃 ─────────────────
  all = filterByRecency(all)

  if (sectorFilter && sectorFilter !== 'all') {
    const filtered = all.filter(i => i.sectors.includes(sectorFilter))
    if (filtered.length < 10) {
      const sec = SECTORS.find(s => s.id === sectorFilter)
      const keywords = sec?.keywords || []
      const extra = all.filter(i =>
        !filtered.includes(i) &&
        keywords.some(kw => (i.title + i.content).toLowerCase().includes(kw.toLowerCase()))
      )
      all = [...filtered, ...extra]
    } else {
      all = filtered
    }
  }

  all = all.slice(0, 300)  // 提高上限，配合时间过滤后仍保留充足信息
  if (translate) all = await translateTitles(all)
  return all
}
