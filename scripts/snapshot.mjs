#!/usr/bin/env node
/**
 * 抓取本地 dev server 的全部数据，生成一份独立 HTML 快照。
 * 双击 dist/snapshot.html 即可在浏览器打开（无需运行 server）。
 *
 * 使用：
 *   1. 保持 dev server 运行：npm run dev (PORT=3001)
 *   2. node scripts/snapshot.mjs
 *   3. 在 Finder 打开 dist/snapshot.html
 */
import fs from 'fs'
import path from 'path'

const BASE = process.env.BASE || 'http://localhost:3001'
const OUT_DIR = path.resolve('dist')
const OUT_FILE = path.join(OUT_DIR, 'snapshot.html')

async function fetchJson(url, timeoutMs = 180000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'connection': 'keep-alive' } })
    if (!res.ok) throw new Error(`${url} → ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

async function main() {
  console.log('▸ 拉取 /api/sentiment …（首次约 30-60s）')
  const sentiment = await fetchJson(`${BASE}/api/sentiment`)
  console.log(`  收到 ${sentiment.sectors?.length || 0} 个板块`)

  console.log('▸ 拉取 /api/news …')
  const newsRaw = await fetchJson(`${BASE}/api/news`)
  // API 返回 { articles: [{ title, content, url, pubDate, source, sectors }] }
  const news = { items: newsRaw.articles || newsRaw.items || [] }
  console.log(`  收到 ${news.items.length} 条资讯`)

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const html = renderHtml({ sentiment, news, generatedAt: new Date() })
  fs.writeFileSync(OUT_FILE, html, 'utf8')
  const sizeKB = (fs.statSync(OUT_FILE).size / 1024).toFixed(1)
  console.log(`✅ 写入 ${OUT_FILE} (${sizeKB} KB)`)
  console.log(`   open ${OUT_FILE}`)
}

// A股惯例：红=看多 / 绿=看空
function scoreColor(score) {
  if (score >= 60) return { bg: '#3a0d0d', text: '#fca5a5', border: '#dc2626' }
  if (score >= 20) return { bg: '#2a1414', text: '#fca5a5', border: '#ef4444' }
  if (score > -20) return { bg: '#1f1f1f', text: '#9ca3af', border: '#4b5563' }
  if (score > -60) return { bg: '#0d2517', text: '#86efac', border: '#22c55e' }
  return { bg: '#0d2f1f', text: '#34d399', border: '#10b981' }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function timeAgo(s) {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T'))
  if (isNaN(d.getTime())) return s
  const diff = Date.now() - d.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h > 48) return Math.floor(h / 24) + '天前'
  if (h > 0) return h + '小时前'
  return Math.max(m, 1) + '分钟前'
}

function renderHtml({ sentiment, news, generatedAt }) {
  const sectors = sentiment.sectors || []
  const newsItems = (news.items || []).slice(0, 80)
  const stats = sectors.length ? {
    avg: Math.round(sectors.reduce((s, d) => s + (d.score || 0), 0) / sectors.length),
    bull: sectors.filter(s => s.score >= 20).length,
    bear: sectors.filter(s => s.score <= -20).length,
    neut: sectors.filter(s => Math.abs(s.score) < 20).length,
  } : null

  const sectorCardsHtml = sectors.map(s => {
    const c = scoreColor(s.score)
    const driverChips = (s.drivers || []).map(d =>
      `<span class="chip">${escapeHtml(d)}</span>`).join('')
    const newsHtml = (s.topNews || []).slice(0, 3).map(n =>
      `<a class="news-item" href="${escapeHtml(n.url)}" target="_blank">
         · ${escapeHtml(n.title)}
         <span class="src">— ${escapeHtml(n.source)}</span>
       </a>`).join('')
    return `
    <div class="card" style="background:${c.bg};border-color:${c.border}">
      <div class="card-head">
        <span class="card-name">${escapeHtml(s.name)}</span>
        <span class="card-score" style="color:${c.text}">${s.score >= 0 ? '+' : ''}${s.score}</span>
      </div>
      <div class="badges">
        <span class="badge" style="background:${c.border}33;color:${c.text}">${escapeHtml(s.label)}</span>
        <span class="badge conf-${s.confidence}">${{ high:'高置信', med:'中置信', low:'低置信' }[s.confidence] || s.confidence}</span>
        <span class="news-count">${s.newsCount} 条资讯</span>
      </div>
      <p class="summary">${escapeHtml(s.summary)}</p>
      ${driverChips ? `<div class="drivers">${driverChips}</div>` : ''}
      ${newsHtml ? `<div class="card-news">${newsHtml}</div>` : ''}
    </div>`
  }).join('')

  const newsListHtml = newsItems.map(n => `
    <a class="news-row" href="${escapeHtml(n.url)}" target="_blank">
      <div class="news-title">${escapeHtml(n.translatedTitle || n.title)}</div>
      <div class="news-meta">
        <span>${escapeHtml(n.source)}</span>
        <span>${escapeHtml(timeAgo(n.pubDate))}</span>
        ${(n.sectors || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
      </div>
    </a>`).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>市场仪表盘 · 快照 ${generatedAt.toLocaleString('zh-CN')}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
         background: #0a0a0a; color: #e5e7eb; }
  header { padding: 20px 24px; border-bottom: 1px solid #1f1f1f; position: sticky; top: 0;
           background: rgba(10,10,10,0.95); backdrop-filter: blur(8px); z-index: 10; }
  header h1 { margin: 0; font-size: 20px; }
  header p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
  nav { margin-top: 12px; display: flex; gap: 4px; }
  nav button { background: none; border: 1px solid #2a2a2a; color: #9ca3af;
               padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  nav button.active { background: #3b82f6; color: white; border-color: #3b82f6; }
  main { max-width: 1400px; margin: 0 auto; padding: 20px; }
  section { display: none; }
  section.active { display: block; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
           gap: 12px; margin-bottom: 20px; }
  .stat { background: #161616; border: 1px solid #2a2a2a; border-radius: 8px; padding: 14px; }
  .stat-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
  .stat-val { font-size: 24px; font-weight: 800; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  .card { border: 1px solid; border-radius: 10px; padding: 16px; }
  .card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .card-name { font-size: 16px; font-weight: 700; }
  .card-score { font-size: 22px; font-weight: 800; }
  .badges { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .conf-high { background: #3b82f622; color: #3b82f6; }
  .conf-med { background: #a855f722; color: #a855f7; }
  .conf-low { background: #6b728022; color: #6b7280; }
  .news-count { font-size: 11px; color: #6b7280; }
  .summary { margin: 0 0 10px; font-size: 13px; line-height: 1.5; color: #d1d5db; }
  .drivers { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
  .chip { background: #1f1f1f; color: #9ca3af; padding: 3px 8px; border-radius: 4px;
          font-size: 11px; border: 1px solid #2a2a2a; }
  .card-news { margin-top: 10px; padding-top: 10px; border-top: 1px solid #2a2a2a; }
  .news-item { display: block; font-size: 12px; color: #9ca3af; padding: 4px 0;
               text-decoration: none; }
  .news-item:hover { color: #d1d5db; }
  .news-item .src { color: #4b5563; }

  .news-row { display: block; padding: 12px 16px; border-bottom: 1px solid #1f1f1f;
              text-decoration: none; color: #e5e7eb; }
  .news-row:hover { background: #161616; }
  .news-title { font-size: 14px; line-height: 1.5; margin-bottom: 4px; }
  .news-meta { font-size: 11px; color: #6b7280; display: flex; gap: 8px; align-items: center; }
  .tag { background: #1f1f1f; padding: 1px 6px; border-radius: 3px; }

  footer { text-align: center; color: #4b5563; font-size: 11px; padding: 24px; }
</style>
</head>
<body>
<header>
  <h1>📊 市场仪表盘 · 离线快照</h1>
  <p>生成于 ${generatedAt.toLocaleString('zh-CN')} · 静态 HTML，可任意时刻双击打开 · 链接均跳原始来源</p>
  <nav>
    <button class="tab active" data-tab="sentiment">📊 情绪雷达 (${sectors.length})</button>
    <button class="tab" data-tab="news">📰 资讯流 (${newsItems.length})</button>
  </nav>
</header>
<main>
  <section id="sentiment" class="active">
    ${stats ? `
    <div class="stats">
      <div class="stat"><div class="stat-label">市场整体均值</div><div class="stat-val" style="color:${scoreColor(stats.avg).text}">${stats.avg >= 0 ? '+' : ''}${stats.avg}</div></div>
      <div class="stat"><div class="stat-label">看多板块</div><div class="stat-val" style="color:#fca5a5">${stats.bull}<span style="font-size:13px;color:#6b7280"> 个</span></div></div>
      <div class="stat"><div class="stat-label">看空板块</div><div class="stat-val" style="color:#86efac">${stats.bear}<span style="font-size:13px;color:#6b7280"> 个</span></div></div>
      <div class="stat"><div class="stat-label">中性板块</div><div class="stat-val" style="color:#9ca3af">${stats.neut}<span style="font-size:13px;color:#6b7280"> 个</span></div></div>
    </div>` : ''}
    <div class="grid">${sectorCardsHtml}</div>
  </section>
  <section id="news">${newsListHtml}</section>
</main>
<footer>红=看多 · 绿=看空（A股惯例）· AI 内容仅供参考，不构成投资建议</footer>
<script>
  document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('section').forEach(s => s.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(btn.dataset.tab).classList.add('active')
    }
  })
</script>
</body>
</html>`
}

main().catch(err => {
  console.error('❌', err.message || err)
  console.error('   提示：请先确保 dev server 运行在', BASE)
  process.exit(1)
})
