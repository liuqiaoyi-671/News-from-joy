import axios from 'axios'
import Parser from 'rss-parser'
import { cached } from './cache'

const parser = new Parser({ timeout: 6000 })

export interface CNewsItem {
  title: string
  content: string
  url: string
  pubDate: string
  source: string
  lang: 'zh'
  sourceCount?: number    // 同一事件在多少个来源被报道（用于判断重大新闻）
  sourceSector?: string   // 通过关键词搜索获得的文章，直接对应的板块 ID
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

// 搜索关键词 → 板块 ID 映射（用于给搜索结果打 sourceSector 标签）
// 关键词越专业越精准，行业研究员实际追踪的术语优先
const KEYWORD_SECTOR_MAP: Record<string, string> = {
  // ── 宏观/政策 ──────────────────────────────────────────────────────────────
  '央行': 'macro',          '美联储': 'macro',       '降准降息': 'macro',
  '财政政策': 'macro',      '货币政策': 'macro',     '经济数据': 'macro',
  'PMI': 'macro',           'CPI': 'macro',           'GDP': 'macro',
  '社融': 'macro',          'M2': 'macro',            '存款准备金': 'macro',
  '外汇储备': 'macro',      '贸易顺差': 'macro',     '工业增加值': 'macro',

  // ── 金融 ──────────────────────────────────────────────────────────────────
  '银行股': 'finance',      '券商': 'finance',        '保险': 'finance',
  '基金': 'finance',        '债券': 'finance',        '信托': 'finance',
  '信用债': 'finance',      '城投债': 'finance',      '北向资金': 'finance',
  '融资融券': 'finance',    'SHIBOR': 'finance',      '存款利率': 'finance',

  // ── 房地产 ────────────────────────────────────────────────────────────────
  '房地产': 'realestate',   '楼市': 'realestate',    '地产政策': 'realestate',
  '物业管理': 'realestate', '新房销售': 'realestate', '房企': 'realestate',
  '30城成交': 'realestate', '土地溢价': 'realestate', '去化周期': 'realestate',
  '库存面积': 'realestate', '新开工': 'realestate',   '竣工面积': 'realestate',

  // ── 能源 ──────────────────────────────────────────────────────────────────
  '原油': 'energy',         '煤炭': 'energy',         '天然气': 'energy',
  '石油化工': 'energy',     '成品油': 'energy',       '液化天然气': 'energy',
  '动力煤': 'energy',       '焦煤': 'energy',         '焦炭': 'energy',
  'Q5500': 'energy',        '坑口价': 'energy',       '秦港库存': 'energy',
  '煤矿安全': 'energy',     '保供': 'energy',         '电煤': 'energy',
  '进口煤': 'energy',       '煤炭产量': 'energy',

  // ── 新能源 ────────────────────────────────────────────────────────────────
  '光伏': 'newenergy',      '锂电池': 'newenergy',    '储能': 'newenergy',
  '风电': 'newenergy',      '碳酸锂': 'newenergy',    '充电桩': 'newenergy',
  '硅料': 'newenergy',      '组件价格': 'newenergy',  '逆变器': 'newenergy',
  '磷酸铁锂': 'newenergy',  '三元材料': 'newenergy',  '电芯': 'newenergy',
  '隔膜': 'newenergy',      '电解液': 'newenergy',    '硫酸钴': 'newenergy',
  '锂价': 'newenergy',      '装机量': 'newenergy',    '海上风电': 'newenergy',

  // ── 农林牧渔（细分专业术语覆盖，直接从行业媒体提取）─────────────────────
  '生猪': 'agriculture',    '大豆': 'agriculture',    '玉米': 'agriculture',
  '小麦': 'agriculture',    '猪价': 'agriculture',    '农产品': 'agriculture',
  '豆粕': 'agriculture',    '养殖': 'agriculture',    '仔猪价格': 'agriculture',
  '能繁母猪': 'agriculture','出栏量': 'agriculture',  '猪粮比': 'agriculture',
  '豆油': 'agriculture',    '菜粕': 'agriculture',    '鱼粉': 'agriculture',
  '禽价': 'agriculture',    '蛋价': 'agriculture',    '禽流感': 'agriculture',
  '非洲猪瘟': 'agriculture','饲料成本': 'agriculture','水产养殖': 'agriculture',
  '白羽鸡': 'agriculture',  '种猪': 'agriculture',    '棕榈油': 'agriculture',
  '南美大豆': 'agriculture','USDA': 'agriculture',

  // ── 食品饮料 ──────────────────────────────────────────────────────────────
  '白酒': 'food',           '食品饮料': 'food',       '啤酒': 'food',
  '乳制品': 'food',         '茅台': 'food',           '调味品': 'food',
  '茅台批价': 'food',       '飞天茅台': 'food',       '酱香型': 'food',
  '春糖': 'food',           '秋糖': 'food',           '白酒库存': 'food',
  '餐饮景气': 'food',

  // ── 化工 ──────────────────────────────────────────────────────────────────
  '化工行业': 'chemicals',  '纯碱': 'chemicals',      'PTA': 'chemicals',
  '聚酯': 'chemicals',      '农药': 'chemicals',       '化肥': 'chemicals',
  'PVC': 'chemicals',       '聚丙烯': 'chemicals',    '苯乙烯': 'chemicals',
  'MDI': 'chemicals',       'TDI': 'chemicals',        '钛白粉': 'chemicals',
  '甲醇': 'chemicals',      '氨纶': 'chemicals',      '粘胶': 'chemicals',
  '尿素': 'chemicals',      '磷肥': 'chemicals',      '煤化工': 'chemicals',

  // ── 钢铁/有色 ─────────────────────────────────────────────────────────────
  '钢铁': 'metals',         '有色金属': 'metals',     '铜价': 'metals',
  '铝': 'metals',           '螺纹钢': 'metals',        '铁矿石': 'metals',
  '铜现货': 'metals',       '电解铜': 'metals',        '废铜': 'metals',
  '铝锭': 'metals',         '锌锭': 'metals',          '镍价': 'metals',
  '钴价': 'metals',         '铅锭': 'metals',          '黄金现货': 'metals',
  '铜精矿': 'metals',       'TC费用': 'metals',        '矿山': 'metals',

  // ── 医药 ──────────────────────────────────────────────────────────────────
  '创新药': 'pharma',       '医疗器械': 'pharma',     '集采': 'pharma',
  'CXO': 'pharma',          '医保': 'pharma',          '生物制药': 'pharma',
  'NDA': 'pharma',          'IND': 'pharma',           'NMPA': 'pharma',
  '1类新药': 'pharma',      '生物类似药': 'pharma',   '细胞治疗': 'pharma',
  'ADC': 'pharma',          'mRNA': 'pharma',          '基因疗法': 'pharma',
  '药品审批': 'pharma',     '医保谈判': 'pharma',     '带量采购': 'pharma',

  // ── AI/科技 ───────────────────────────────────────────────────────────────
  '人工智能': 'ai',         '大模型': 'ai',            '算力': 'ai',
  '数据中心': 'ai',         '云计算': 'ai',            'DeepSeek': 'ai',
  '智算中心': 'ai',         '液冷': 'ai',              'GPU服务器': 'ai',
  '国产大模型': 'ai',       'Kimi': 'ai',              '文心一言': 'ai',
  '信创': 'ai',             '数字政府': 'ai',

  // ── 半导体 ────────────────────────────────────────────────────────────────
  '半导体': 'semiconductor','芯片': 'semiconductor',  '集成电路': 'semiconductor',
  '晶圆': 'semiconductor',  '光刻机': 'semiconductor','先进封装': 'semiconductor',
  'HBM': 'semiconductor',   'CoWoS': 'semiconductor', 'N2': 'semiconductor',
  '台积电': 'semiconductor','中芯国际': 'semiconductor','北方华创': 'semiconductor',
  '刻蚀机': 'semiconductor','CVD': 'semiconductor',   '功率半导体': 'semiconductor',
  'AMOLED': 'semiconductor','面板价格': 'semiconductor',

  // ── 汽车 ──────────────────────────────────────────────────────────────────
  '新能源车': 'auto',       '智能驾驶': 'auto',       '比亚迪': 'auto',
  '汽车销量': 'auto',       '车企': 'auto',            '电动车': 'auto',
  '渗透率': 'auto',         '插混': 'auto',            'PHEV': 'auto',
  '出口量': 'auto',         '价格战': 'auto',          '乘联会': 'auto',
  '理想汽车': 'auto',       '小鹏': 'auto',            '特斯拉交付': 'auto',

  // ── 消费/零售 ─────────────────────────────────────────────────────────────
  '消费电子': 'consumer',   '家电': 'consumer',        '零售': 'consumer',
  '旅游': 'consumer',       '免税': 'consumer',        '直播电商': 'consumer',
  '社零': 'consumer',       '消费复苏': 'consumer',    '出行数据': 'consumer',

  // ── 军工 ──────────────────────────────────────────────────────────────────
  '军工': 'defense',        '航天': 'defense',         '国防': 'defense',
  '商业航天': 'defense',    '军费': 'defense',         '卫星': 'defense',
  '航发动力': 'defense',    '歼': 'defense',           '舰船': 'defense',

  // ── 通信 ──────────────────────────────────────────────────────────────────
  '5G': 'telecom',          '6G': 'telecom',           '卫星通信': 'telecom',
  '运营商': 'telecom',      '物联网': 'telecom',       '低轨卫星': 'telecom',
  'Starlink': 'telecom',    '天地一体': 'telecom',

  // ── 机械 ──────────────────────────────────────────────────────────────────
  '工程机械': 'machinery',  '机器人': 'machinery',     '工业自动化': 'machinery',
  '数控机床': 'machinery',  '挖掘机': 'machinery',     '人形机器人': 'machinery',
  '工业母机': 'machinery',

  // ── 环保/公用 ─────────────────────────────────────────────────────────────
  '环保': 'environment',    '碳交易': 'environment',  '电力': 'environment',
  '核电': 'environment',    '水务': 'environment',     '碳排放权': 'environment',
  '绿证': 'environment',

  // ── 交通运输 ──────────────────────────────────────────────────────────────
  '航运': 'transport',      '物流': 'transport',       '快递': 'transport',
  '集运': 'transport',      '民航': 'transport',       '港口': 'transport',
  'SCFI': 'transport',      'BDI': 'transport',        '运价指数': 'transport',
}

// 每个行业 1-2 个高区分度关键词 — 确保跨行业均衡覆盖
const EASTMONEY_SEARCH_KEYWORDS = Object.keys(KEYWORD_SECTOR_MAP)

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

// ── 通用财经 RSS ───────────────────────────────────────────────────────────────
const ZH_RSS_SOURCES_GENERAL = [
  { url: 'https://www.yicai.com/rss/news.xml',                          label: '第一财经' },
  { url: 'https://wallstreetcn.com/rss',                                label: '华尔街见闻' },
  { url: 'https://36kr.com/feed',                                       label: '36氪' },
  { url: 'https://www.huxiu.com/rss/0.xml',                            label: '虎嗅' },
  { url: 'https://www.tmtpost.com/feed',                                label: '钛媒体' },
  { url: 'https://a.jiemian.com/index.php?m=article&a=rss',           label: '界面新闻' },
  { url: 'http://rss.sina.com.cn/finance/future.xml',                  label: '新浪·期货' },
]

// ── 行业专属垂直媒体 RSS ───────────────────────────────────────────────────────
// 每个板块挂 1-3 个专业来源，仅该板块请求时拉取（减少无关干扰）
// 说明：
//   - 集微网 (jiemi.cn)       → 半导体/芯片，每日原创新闻
//   - 芯东西 (xindonxi.cn)    → 半导体/消费电子，深度报道
//   - 高工锂电 (gglithium)    → 锂电/新能源，产业链价格
//   - 我的钢铁 Mysteel        → 钢铁/有色，行业权威
//   - SMM 上海有色             → 铜/铝/镍/钴等大宗金属
//   - 健康界 (cn-healthcare)   → 医药/医疗，政策+临床
//   - 赛柏蓝 (saibull)        → 医药，政策带量采购重点
//   - 农财宝典 / 新牧网        → 农牧，养殖+饲料原料
//   - 中国化工网               → 化工
//   - 粮油市场报               → 食品饮料上游原料
//   - 能源界 (nengyuanjie)    → 能源/煤炭/天然气
//   - 房天下资讯               → 地产
const ZH_RSS_SOURCES_SECTOR: Record<string, { url: string; label: string }[]> = {
  semiconductor: [
    { url: 'https://www.jiemian.com/lists/11.rss',                     label: '界面·科技' },
    { url: 'https://36kr.com/feed/column/100007',                      label: '36氪·硬科技' },
  ],
  ai: [
    { url: 'https://36kr.com/feed/column/100006',                      label: '36氪·人工智能' },
    { url: 'https://www.tmtpost.com/tag/AI/feed',                      label: '钛媒体·AI' },
  ],
  newenergy: [
    { url: 'https://news.bjx.com.cn/rss/',                             label: '北极星电力网' },
    { url: 'https://www.ne21.com/rss/news.xml',                        label: '北极星新能源' },
  ],
  metals: [
    { url: 'https://news.mysteel.com/rss.xml',                         label: 'Mysteel钢铁' },
    { url: 'https://www.smm.cn/rss.xml',                               label: 'SMM有色' },
  ],
  pharma: [
    { url: 'https://www.cn-healthcare.com/rss/all.xml',                label: '健康界' },
    { url: 'https://www.yicai.com/rss/health.xml',                     label: '第一财经·健康' },
  ],
  agriculture: [
    { url: 'http://www.feedtrade.com.cn/rss.xml',                      label: '饲料行业信息' },
    { url: 'https://www.nczd.com/rss/',                                 label: '农财宝典' },
  ],
  energy: [
    { url: 'https://www.china-nengyuan.com/rss.xml',                   label: '能源界' },
    { url: 'http://rss.sina.com.cn/finance/energy.xml',                label: '新浪·能源' },
  ],
  chemicals: [
    { url: 'http://www.chemnet.com.cn/rss/news.xml',                   label: '中国化工网' },
    { url: 'https://www.ccin.com.cn/rss',                              label: '中化新网' },
  ],
  realestate: [
    { url: 'https://www.fang.com/rss/news.xml',                        label: '房天下·资讯' },
    { url: 'http://rss.sina.com.cn/estate/new.xml',                    label: '新浪·房产' },
  ],
  transport: [
    { url: 'http://rss.sina.com.cn/finance/logistic.xml',              label: '新浪·物流' },
  ],
}

// 合并后对外使用：通用 + 所有垂直板块（批量预热时全拉；按板块查询时还可精确过滤）
const ZH_RSS_SOURCES = [
  ...ZH_RSS_SOURCES_GENERAL,
  ...Object.values(ZH_RSS_SOURCES_SECTOR).flat(),
]

// ─── 主入口 ───────────────────────────────────────────────────────────────────
// 5 min 内部缓存：防止多路调用（sentiment 预热 + news API 正常刷新）同时触发几十个 HTTP 请求
export function fetchChineseNews(): Promise<CNewsItem[]> {
  return cached('cnews:raw', _fetchChineseNewsRaw, { ttl: 5 * 60_000 })
}

async function _fetchChineseNewsRaw(): Promise<CNewsItem[]> {
  const tasks: Promise<CNewsItem[]>[] = [
    // 新浪财经主分类 — 多页拉取以保证行业覆盖
    ...SINA_CATEGORIES.flatMap(c =>
      Array.from({ length: c.pages }, (_, i) => fetchSinaCategory(c.lid, i + 1, c.label))
    ),
    // 东方财富
    ...EASTMONEY_CATEGORIES.map(c => fetchEastmoneyCategory(c.source, c.label)),
    // 财联社电报
    fetchCLS(),
    // 东财关键词搜索 — 结果直接打上对应板块 sourceSector，避免全文关键词误归板块
    ...EASTMONEY_SEARCH_KEYWORDS.map(kw =>
      fetchEastmoneySearch(kw).then(items =>
        items.map(i => ({ ...i, sourceSector: KEYWORD_SECTOR_MAP[kw] }))
      )
    ),
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
      if (jaccardSim(bg, keptBigrams[i]) > 0.35) { matched = i; break }
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
