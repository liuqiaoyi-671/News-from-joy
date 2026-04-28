import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { INDICATOR_CATALOG, TOPIC_PRESETS } from '@/lib/indicators'
import { cached } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Analyst context for each indicator — used to improve AI recommendations
const INDICATOR_NOTES: Record<string, string> = {
  // 宏观
  ust10y:     '全球资产定价基准，影响估值和融资成本',
  ust2y:      '货币政策预期指标，与10年期利差反映衰退信号',
  dxy:        '美元强弱指数，大宗商品反向指标，影响新兴市场资金流',
  cnyusd:     '中美贸易和跨境资本流动指标',
  vix:        '市场恐慌程度，急升时risk-off，影响风险资产定价',
  // A股指数
  sh:         '上证综合指数，A股整体情绪',
  sz:         '深证成指，深市整体情绪',
  csi300:     '沪深300，A股机构重仓股基准',
  csi500:     '中证500，中盘成长与周期股集中',
  gem:        '创业板，A股成长/科技属性最强',
  sh50:       '上证50，A股蓝筹龙头',
  // 申万行业ETF
  bank_etf:   '申万银行行业ETF，跟踪国内银行股',
  broker_etf: '券商ETF，资本市场景气度代理',
  xbf:        '非银金融ETF，含保险/证券/信托',
  coal_etf:   '煤炭ETF，动力煤/焦煤产业链上游',
  petro_etf:  '石油石化ETF，跟踪中石化/中石油等',
  metal_etf:  '有色金属ETF，铜铝锌镍综合',
  steel_etf:  '钢铁ETF，螺纹钢产业链',
  chem_etf:   '化工ETF，PTA/MDI/纯碱等',
  elec_etf:   '电子ETF，PCB/面板/消费电子',
  chip_etf:   '芯片ETF，国证芯片指数，国产替代方向',
  semi_etf:   '半导体ETF，中芯国际/北方华创等',
  it_etf:     '计算机ETF，信创/云计算/软件',
  tel_etf:    '通信ETF，5G设备/运营商',
  media_etf:  '传媒ETF，影视/游戏/广告',
  def_etf:    '军工ETF，航天航空/武器装备',
  auto_etf:   '汽车ETF，整车+零部件，新能源车受益',
  mach_etf:   '机械ETF，工程机械/工业母机/机器人',
  pharma_etf: '医药ETF，申万医药生物板块',
  med_etf:    '医疗ETF，医疗器械/CXO/创新药',
  agri_etf:   '农业ETF，种植/养殖/农化上市公司',
  food_etf:   '食品饮料ETF，白酒+调味品+乳制品等',
  liquor_etf: '白酒ETF，茅台/五粮液/泸州老窖',
  home_etf:   '家电ETF，美的/格力/海尔等',
  solar_etf:  '光伏ETF，产业链从硅料到组件',
  li_etf:     '碳酸锂ETF，新能源电池核心原材料',
  re_etf:     '房地产ETF，跟踪A股地产板块',
  bld_etf:    '建材ETF，水泥/玻璃/防水等',
  util_etf:   '公用事业ETF，电力/水务/燃气',
  trans_etf:  '交通运输ETF，航空/航运/物流',
  env_etf:    '环保ETF，污水/固废/大气治理',
  // 大宗商品
  oil:        '全球能源价格基准，影响通胀和化工成本',
  gold:       '避险资产，与实际利率和美元负相关',
  silver:     '工业+贵金属双重属性，对太阳能敏感',
  copper:     '经济晴雨表，工业需求代理，新能源用铜量大',
  natgas:     '欧洲能源危机和冬季取暖需求关键指标',
  // 农产品
  soybean:    '全球蛋白粮定价基准，影响豆粕豆油价格',
  corn:       '全球饲料粮基准，决定养猪禽类养殖成本',
  wheat:      '全球口粮价格，对地缘政治敏感',
  hogs:       '国内生猪期货，猪周期代理，直接影响CPI',
  cotton:     '纺织服装成本核心，受天气和种植面积影响',
  sugar:      '全球食糖供需，与巴西甘蔗种植和乙醇政策相关',
  // 美股/科技
  sox:        '全球半导体景气度代理，领先科技股表现',
  nvda:       'AI算力代表股，数据中心GPU需求风向标',
  tsm:        '台积电ADR，全球先进制程供给侧',
  spx:        'S&P500，美国最广泛股市基准',
  ndx:        '纳斯达克100，科技股集中指数',
  qqq:        '纳斯达克100ETF，科技龙头',
  msft:       '微软，云计算+AI Copilot受益者',
  googl:      '谷歌，AI搜索+云计算',
  aapl:       '苹果，消费电子龙头，中国区销量重要',
  meta:       'Meta，AI广告+元宇宙',
  amzn:       '亚马逊，云计算AWS+电商',
  hsi:        '恒生指数，港股整体',
  hstech:     '恒生科技，港股科技龙头',
  n225:       '日经225，日本股市，半导体/汽车权重高',
  // 新能源车
  tsla:       '特斯拉，全球EV市场引领者',
  byd_hk:     '比亚迪港股，国内EV龙头',
  // 加密
  btc:        '比特币，加密市场流动性风向标',
  eth:        '以太坊，智能合约生态代表',
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q.trim()) return { ids: [], label: '' }
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'

  // 同 query 24h 缓存
  const result = await cached(`ai-suggest:${q.trim().toLowerCase()}`, () =>
    runSuggest(q), { ttl: 24 * 3600_000, fresh })
  return result
}

async function runSuggest(q: string): Promise<{ ids: string[]; label: string; source?: string }> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) {
    // Fallback to presets
    const qLower = q.toLowerCase()
    for (const [topic, ids] of Object.entries(TOPIC_PRESETS)) {
      if (qLower.includes(topic.toLowerCase())) return { ids, label: topic }
    }
    return { ids: [], label: q }
  }

  // Build indicator list with notes for the prompt
  const indicatorList = Object.values(INDICATOR_CATALOG)
    .map(ind => `${ind.id}(${ind.name}${INDICATOR_NOTES[ind.id] ? '：' + INDICATOR_NOTES[ind.id] : ''})`)
    .join('\n')

  const prompt = `你是一位有10年经验的卖方分析师，专注于大宗商品、A股和全球宏观研究。

用户说他最近在关注："${q}"

根据真实的卖方研报逻辑，推荐最应该跟踪的指标：
- 行业上下游核心价格（如农业必看大豆、玉米等）
- 行业景气度代理指标
- 宏观影响变量（汇率、利率、大宗商品等）
- 全球定价参考（如国内农产品必看芝加哥期货）
- 相关行业ETF或龙头股

可选指标（格式：id(名称：说明)）：
${indicatorList}

从上面选出8-12个最相关的指标ID，按重要性排序。
**只返回JSON数组，如["id1","id2"]，不要任何其他内容。**`

  try {
    const res = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 512,
        stream: false,
      },
      {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    )
    const text: string = res.data?.choices?.[0]?.message?.content || '[]'
    const match = text.match(/\[[\s\S]*?\]/)
    if (match) {
      const ids: string[] = JSON.parse(match[0]).filter((id: string) => INDICATOR_CATALOG[id])
      if (ids.length > 0) return { ids, label: q, source: 'ai' }
    }
  } catch { /* fallback below */ }

  // Fallback to presets
  const qLower = q.toLowerCase()
  for (const [topic, ids] of Object.entries(TOPIC_PRESETS)) {
    if (qLower.includes(topic.toLowerCase())) return { ids, label: topic, source: 'preset' }
  }
  // Last resort: return some default macro indicators
  return {
    ids: ['vix', 'ust10y', 'dxy', 'oil', 'gold', 'spx'],
    label: q,
    source: 'default',
  }
}
