import { NextRequest, NextResponse } from 'next/server'
import { getUSMarket } from '@/lib/yahoo'
import { getCNIndices } from '@/lib/tushare'
import { fetchNews } from '@/lib/news'
import { generateDailySummary } from '@/lib/gemini'
import { sendEmail, buildEmailHtml } from '@/lib/email'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const [usData, cnData, news] = await Promise.all([getUSMarket(), getCNIndices(), fetchNews()])
    const marketSummary = [
      ...cnData.map((m) => ({ name: m.name, pct_chg: m.pct_chg })),
      ...usData.slice(0, 4).map((m) => ({ name: m.name, pct_chg: m.pct_chg })),
    ]
    const topNews = news.slice(0, 6).map((n) => ({ title: n.title, url: n.url }))

    const summary = await generateDailySummary(marketSummary, topNews, 'postmarket')
    const html = buildEmailHtml('今日市场资讯总结', summary, 'postmarket')

    const to = process.env.DEFAULT_TO_EMAIL!
    await sendEmail({ to, subject: `📊 盘后总结 ${new Date().toLocaleDateString('zh-CN')}`, html })

    return NextResponse.json({ ok: true, to })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
