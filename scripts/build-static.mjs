#!/usr/bin/env node
/**
 * 构建可上传的纯静态站点（无后端）
 *
 * 流程：
 *   1. 从 dev server (localhost:3001) 拉取 sentiment + news 数据
 *   2. 写入 public/sentiment-data.json 和 public/news-data.json
 *   3. 用 BUILD_STATIC=1 触发 Next 静态导出 → out/
 *
 * 输出：
 *   out/sentiment/index.html  ← 双击即开
 *   out/news/index.html
 *   out/                        ← 整个文件夹可上传到 GitHub Pages / Netlify / Vercel / 任意静态主机
 *
 * 用法：
 *   1. 确保 dev server 正在 localhost:3001 运行（npm run dev）
 *   2. npm run export
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const BASE = process.env.BASE || 'http://localhost:3001'
const PUBLIC_DIR = path.resolve('public')

async function fetchJson(url, timeoutMs = 240000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`${url} → ${res.status}`)
    return await res.json()
  } finally { clearTimeout(t) }
}

async function main() {
  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true })

  console.log('▸ 拉取 /api/sentiment（首次约 30-90s）…')
  const sentiment = await fetchJson(`${BASE}/api/sentiment`)
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sentiment-data.json'), JSON.stringify(sentiment))
  console.log(`  ✓ 板块 ${sentiment.sectors?.length || 0}`)

  console.log('▸ 拉取 /api/news …')
  const news = await fetchJson(`${BASE}/api/news`)
  fs.writeFileSync(path.join(PUBLIC_DIR, 'news-data.json'), JSON.stringify(news))
  console.log(`  ✓ 资讯 ${news.articles?.length || 0}`)

  // 静态导出不能包含 API 路由 — 临时移走 app/api，build 完再放回
  const apiSrc = path.resolve('app/api')
  const apiBak = path.resolve('.api-bak')
  let movedApi = false
  if (fs.existsSync(apiSrc)) {
    if (fs.existsSync(apiBak)) fs.rmSync(apiBak, { recursive: true, force: true })
    fs.renameSync(apiSrc, apiBak)
    movedApi = true
    console.log('▸ 临时隐藏 app/api/ → .api-bak/')
  }

  try {
    console.log('▸ Next 静态导出（BUILD_STATIC=1 next build）…')
    execSync('BUILD_STATIC=1 npx next build', { stdio: 'inherit' })
  } finally {
    if (movedApi) {
      if (fs.existsSync(apiSrc)) fs.rmSync(apiSrc, { recursive: true, force: true })
      fs.renameSync(apiBak, apiSrc)
      console.log('▸ 恢复 app/api/')
    }
  }

  console.log('\n✅ 完成！')
  console.log('   双击打开：out/sentiment/index.html')
  console.log('   或上传整个 out/ 文件夹到任意静态主机')
}

main().catch(err => {
  console.error('❌', err.message || err)
  process.exit(1)
})
