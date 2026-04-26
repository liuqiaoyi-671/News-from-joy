export type IndicatorType = 'cn_index' | 'us' | 'commodity' | 'crypto' | 'bond' | 'fx'

export interface Indicator {
  id: string
  name: string
  type: IndicatorType
  symbol?: string   // Yahoo Finance / Sina Finance (for cn_index)
  unit?: string
  description?: string
}

export const INDICATOR_CATALOG: Record<string, Indicator> = {
  // ─── A股主要指数 ──────────────────────────────────────────────────
  sh:        { id: 'sh',        name: '上证指数',     type: 'cn_index', symbol: '000001.SS' },
  sz:        { id: 'sz',        name: '深证成指',     type: 'cn_index', symbol: '399001.SZ' },
  csi300:    { id: 'csi300',    name: '沪深300',      type: 'cn_index', symbol: '000300.SS' },
  csi500:    { id: 'csi500',    name: '中证500',      type: 'cn_index', symbol: '000905.SS' },
  gem:       { id: 'gem',       name: '创业板指',     type: 'cn_index', symbol: '399006.SZ' },
  sh50:      { id: 'sh50',      name: '上证50',       type: 'cn_index', symbol: '000016.SS' },

  // ─── 申万行业ETF：金融 ────────────────────────────────────────────
  bank_etf:  { id: 'bank_etf',  name: '银行ETF',      type: 'cn_index', symbol: '512800.SS' },
  broker_etf:{ id: 'broker_etf',name: '券商ETF',      type: 'cn_index', symbol: '512000.SS' },
  xbf:       { id: 'xbf',       name: '非银金融ETF',  type: 'cn_index', symbol: '159931.SZ' },

  // ─── 申万行业ETF：能源 ────────────────────────────────────────────
  coal_etf:  { id: 'coal_etf',  name: '煤炭ETF',      type: 'cn_index', symbol: '515220.SS' },
  petro_etf: { id: 'petro_etf', name: '石油石化ETF',  type: 'cn_index', symbol: '159731.SZ' },

  // ─── 申万行业ETF：有色金属 & 钢铁 ────────────────────────────────
  metal_etf: { id: 'metal_etf', name: '有色金属ETF',  type: 'cn_index', symbol: '512400.SS' },
  steel_etf: { id: 'steel_etf', name: '钢铁ETF',      type: 'cn_index', symbol: '515210.SS' },

  // ─── 申万行业ETF：化工 ────────────────────────────────────────────
  chem_etf:  { id: 'chem_etf',  name: '化工ETF',      type: 'cn_index', symbol: '516020.SS' },

  // ─── 申万行业ETF：电子 & 半导体 ──────────────────────────────────
  elec_etf:  { id: 'elec_etf',  name: '电子ETF',      type: 'cn_index', symbol: '515260.SS' },
  chip_etf:  { id: 'chip_etf',  name: '芯片ETF',      type: 'cn_index', symbol: '159995.SZ' },
  semi_etf:  { id: 'semi_etf',  name: '半导体ETF',    type: 'cn_index', symbol: '512480.SS' },

  // ─── 申万行业ETF：计算机 ──────────────────────────────────────────
  it_etf:    { id: 'it_etf',    name: '计算机ETF',    type: 'cn_index', symbol: '512720.SS' },

  // ─── 申万行业ETF：通信 & 传媒 ────────────────────────────────────
  tel_etf:   { id: 'tel_etf',   name: '通信ETF',      type: 'cn_index', symbol: '515880.SS' },
  media_etf: { id: 'media_etf', name: '传媒ETF',      type: 'cn_index', symbol: '512980.SS' },

  // ─── 申万行业ETF：国防军工 ────────────────────────────────────────
  def_etf:   { id: 'def_etf',   name: '军工ETF',      type: 'cn_index', symbol: '512660.SS' },

  // ─── 申万行业ETF：汽车 ────────────────────────────────────────────
  auto_etf:  { id: 'auto_etf',  name: '汽车ETF',      type: 'cn_index', symbol: '516110.SS' },

  // ─── 申万行业ETF：机械设备 ────────────────────────────────────────
  mach_etf:  { id: 'mach_etf',  name: '机械ETF',      type: 'cn_index', symbol: '159886.SZ' },

  // ─── 申万行业ETF：医药生物 ────────────────────────────────────────
  pharma_etf:{ id: 'pharma_etf',name: '医药ETF',      type: 'cn_index', symbol: '159929.SZ' },
  med_etf:   { id: 'med_etf',   name: '医疗ETF',      type: 'cn_index', symbol: '512170.SS' },

  // ─── 申万行业ETF：农林牧渔 ────────────────────────────────────────
  agri_etf:  { id: 'agri_etf',  name: '农业ETF',      type: 'cn_index', symbol: '159825.SZ' },

  // ─── 申万行业ETF：食品饮料 ────────────────────────────────────────
  food_etf:  { id: 'food_etf',  name: '食品饮料ETF',  type: 'cn_index', symbol: '515170.SS' },
  liquor_etf:{ id: 'liquor_etf',name: '白酒ETF',      type: 'cn_index', symbol: '512690.SS' },

  // ─── 申万行业ETF：家用电器 ────────────────────────────────────────
  home_etf:  { id: 'home_etf',  name: '家电ETF',      type: 'cn_index', symbol: '159996.SZ' },

  // ─── 申万行业ETF：新能源 ──────────────────────────────────────────
  solar_etf: { id: 'solar_etf', name: '光伏ETF',      type: 'cn_index', symbol: '515790.SS' },
  li_etf:    { id: 'li_etf',    name: '碳酸锂ETF',    type: 'cn_index', symbol: '159766.SZ' },

  // ─── 申万行业ETF：房地产 & 建材 ──────────────────────────────────
  re_etf:    { id: 're_etf',    name: '房地产ETF',    type: 'cn_index', symbol: '159726.SZ' },
  bld_etf:   { id: 'bld_etf',   name: '建材ETF',      type: 'cn_index', symbol: '159745.SZ' },

  // ─── 申万行业ETF：公用事业 & 交通运输 ────────────────────────────
  util_etf:  { id: 'util_etf',  name: '公用事业ETF',  type: 'cn_index', symbol: '159611.SZ' },
  trans_etf: { id: 'trans_etf', name: '交通运输ETF',  type: 'cn_index', symbol: '159666.SZ' },

  // ─── 申万行业ETF：环保 ────────────────────────────────────────────
  env_etf:   { id: 'env_etf',   name: '环保ETF',      type: 'cn_index', symbol: '512580.SS' },

  // ─── 美股指数 ──────────────────────────────────────────────────────
  spx:       { id: 'spx',       name: 'S&P 500',      type: 'us',       symbol: '^GSPC' },
  ndx:       { id: 'ndx',       name: '纳斯达克',     type: 'us',       symbol: '^IXIC' },
  dji:       { id: 'dji',       name: '道琼斯',       type: 'us',       symbol: '^DJI' },
  rut:       { id: 'rut',       name: '罗素2000',     type: 'us',       symbol: '^RUT' },

  // ─── 港股 & 亚太 ───────────────────────────────────────────────────
  hsi:       { id: 'hsi',       name: '恒生指数',     type: 'us',       symbol: '^HSI' },
  hstech:    { id: 'hstech',    name: '恒生科技',     type: 'us',       symbol: '3033.HK' },
  n225:      { id: 'n225',      name: '日经225',      type: 'us',       symbol: '^N225' },

  // ─── 宏观/情绪 ──────────────────────────────────────────────────────
  vix:       { id: 'vix',       name: 'VIX恐慌指数',  type: 'us',       symbol: '^VIX',    description: '市场恐慌程度' },
  ust10y:    { id: 'ust10y',    name: '10年期美债',   type: 'bond',     symbol: '^TNX',    unit: '%' },
  ust2y:     { id: 'ust2y',     name: '2年期美债',    type: 'bond',     symbol: '^FVX',    unit: '%' },
  dxy:       { id: 'dxy',       name: '美元指数',     type: 'fx',       symbol: 'DX-Y.NYB' },
  cnyusd:    { id: 'cnyusd',    name: '人民币/美元',  type: 'fx',       symbol: 'CNY=X' },

  // ─── 大宗商品 ───────────────────────────────────────────────────────
  oil:       { id: 'oil',       name: 'WTI原油',      type: 'commodity', symbol: 'CL=F',   unit: '$/桶' },
  gold:      { id: 'gold',      name: '黄金',         type: 'commodity', symbol: 'GC=F',   unit: '$/盎司' },
  silver:    { id: 'silver',    name: '白银',         type: 'commodity', symbol: 'SI=F',   unit: '$/盎司' },
  copper:    { id: 'copper',    name: '铜期货',       type: 'commodity', symbol: 'HG=F',   unit: '$/磅' },
  natgas:    { id: 'natgas',    name: '天然气',       type: 'commodity', symbol: 'NG=F',   unit: '$/百万英热' },

  // ─── 农产品期货 ─────────────────────────────────────────────────────
  soybean:   { id: 'soybean',   name: '大豆期货',     type: 'commodity', symbol: 'ZS=F',   unit: '美分/蒲' },
  corn:      { id: 'corn',      name: '玉米期货',     type: 'commodity', symbol: 'ZC=F',   unit: '美分/蒲' },
  wheat:     { id: 'wheat',     name: '小麦期货',     type: 'commodity', symbol: 'ZW=F',   unit: '美分/蒲' },
  hogs:      { id: 'hogs',      name: '生猪期货',     type: 'commodity', symbol: 'HE=F',   unit: '美分/磅' },
  cattle:    { id: 'cattle',    name: '活牛期货',     type: 'commodity', symbol: 'LE=F',   unit: '美分/磅' },
  sugar:     { id: 'sugar',     name: '白糖期货',     type: 'commodity', symbol: 'SB=F',   unit: '美分/磅' },
  coffee:    { id: 'coffee',    name: '咖啡期货',     type: 'commodity', symbol: 'KC=F',   unit: '美分/磅' },
  cotton:    { id: 'cotton',    name: '棉花期货',     type: 'commodity', symbol: 'CT=F',   unit: '美分/磅' },

  // ─── 科技/AI 个股 ───────────────────────────────────────────────────
  sox:       { id: 'sox',       name: '费城半导体',   type: 'us',       symbol: '^SOX' },
  nvda:      { id: 'nvda',      name: 'NVIDIA',       type: 'us',       symbol: 'NVDA' },
  tsm:       { id: 'tsm',       name: '台积电ADR',    type: 'us',       symbol: 'TSM' },
  qqq:       { id: 'qqq',       name: '纳斯达克100',  type: 'us',       symbol: 'QQQ' },
  msft:      { id: 'msft',      name: '微软',         type: 'us',       symbol: 'MSFT' },
  googl:     { id: 'googl',     name: '谷歌',         type: 'us',       symbol: 'GOOGL' },
  aapl:      { id: 'aapl',      name: '苹果',         type: 'us',       symbol: 'AAPL' },
  meta:      { id: 'meta',      name: 'Meta',         type: 'us',       symbol: 'META' },
  amzn:      { id: 'amzn',      name: '亚马逊',       type: 'us',       symbol: 'AMZN' },

  // ─── 新能源/汽车个股 ────────────────────────────────────────────────
  tsla:      { id: 'tsla',      name: '特斯拉',       type: 'us',       symbol: 'TSLA' },
  byd_hk:   { id: 'byd_hk',    name: '比亚迪(港)',   type: 'us',       symbol: '1211.HK' },

  // ─── 加密货币 ───────────────────────────────────────────────────────
  btc:       { id: 'btc',       name: '比特币',       type: 'crypto',   symbol: 'BTC-USD', unit: 'USD' },
  eth:       { id: 'eth',       name: '以太坊',       type: 'crypto',   symbol: 'ETH-USD', unit: 'USD' },
}

// ─── 基础指标（始终显示）────────────────────────────────────────────
export const BASE_CN = ['sh', 'sz', 'csi300', 'gem', 'csi500']
export const BASE_US = ['spx', 'ndx', 'dji', 'vix', 'ust10y', 'oil', 'gold', 'dxy', 'btc']

// ─── 预设话题 → 指标映射（AI 回退时使用）───────────────────────────
export const TOPIC_PRESETS: Record<string, string[]> = {
  农业:     ['soybean', 'corn', 'wheat', 'hogs', 'cotton', 'sugar', 'agri_etf', 'dxy', 'oil'],
  粮食:     ['soybean', 'corn', 'wheat', 'hogs', 'agri_etf', 'dxy'],
  新能源:   ['copper', 'tsla', 'li_etf', 'solar_etf', 'oil', 'natgas', 'gem', 'metal_etf'],
  光伏:     ['solar_etf', 'copper', 'silver', 'gem', 'li_etf'],
  储能:     ['li_etf', 'metal_etf', 'copper', 'solar_etf'],
  半导体:   ['sox', 'nvda', 'tsm', 'qqq', 'chip_etf', 'semi_etf', 'elec_etf'],
  芯片:     ['chip_etf', 'semi_etf', 'sox', 'nvda', 'tsm', 'qqq'],
  AI:       ['nvda', 'msft', 'googl', 'sox', 'qqq', 'ndx', 'it_etf', 'chip_etf'],
  人工智能: ['nvda', 'msft', 'googl', 'sox', 'qqq', 'ndx', 'it_etf'],
  黄金:     ['gold', 'silver', 'dxy', 'ust10y', 'vix'],
  原油:     ['oil', 'natgas', 'petro_etf', 'dxy', 'vix'],
  能源:     ['oil', 'natgas', 'coal_etf', 'petro_etf', 'dxy'],
  煤炭:     ['coal_etf', 'natgas', 'oil', 'steel_etf'],
  钢铁:     ['steel_etf', 'coal_etf', 'chem_etf', 'copper', 'metal_etf'],
  有色金属: ['metal_etf', 'copper', 'silver', 'gold', 'dxy'],
  化工:     ['chem_etf', 'oil', 'natgas', 'copper', 'cotton'],
  房地产:   ['re_etf', 'copper', 'bld_etf', 'ust10y', 'ust2y', 'dxy'],
  建材:     ['bld_etf', 're_etf', 'coal_etf', 'steel_etf', 'copper'],
  医药:     ['pharma_etf', 'med_etf', 'gem'],
  金融:     ['bank_etf', 'broker_etf', 'xbf', 'ust10y', 'dxy', 'vix'],
  银行:     ['bank_etf', 'ust10y', 'ust2y', 'dxy', 'vix'],
  加密货币: ['btc', 'eth', 'dxy', 'vix'],
  比特币:   ['btc', 'eth', 'dxy'],
  外汇:     ['dxy', 'cnyusd', 'gold', 'ust10y'],
  汇率:     ['dxy', 'cnyusd', 'gold'],
  宏观:     ['vix', 'ust10y', 'ust2y', 'dxy', 'gold', 'oil', 'cnyusd'],
  军工:     ['def_etf', 'it_etf', 'chip_etf', 'gem'],
  汽车:     ['auto_etf', 'tsla', 'byd_hk', 'copper', 'li_etf', 'oil'],
  新能源车: ['auto_etf', 'tsla', 'byd_hk', 'li_etf', 'copper', 'solar_etf'],
  机械:     ['mach_etf', 'copper', 'steel_etf', 'coal_etf'],
  家电:     ['home_etf', 'copper', 'steel_etf', 'dxy'],
  食品饮料: ['food_etf', 'liquor_etf', 'agri_etf', 'soybean', 'corn', 'sugar'],
  白酒:     ['liquor_etf', 'food_etf', 'sh'],
  通信:     ['tel_etf', 'chip_etf', 'sox', 'ndx'],
  传媒:     ['media_etf', 'it_etf', 'gem'],
  环保:     ['env_etf', 'util_etf', 'copper', 'coal_etf'],
  公用事业: ['util_etf', 'coal_etf', 'natgas', 'ust10y'],
  交通运输: ['trans_etf', 'oil', 'natgas'],
  港股:     ['hsi', 'hstech', 'byd_hk', 'cnyusd'],
  日本:     ['n225', 'dxy'],
}
