import { NextRequest, NextResponse } from 'next/server'
import { generatePostmarketReport, buildPostmarketEmailHtml } from '@/lib/postmarket'
import { sendEmail } from '@/lib/email'
import { getPostmarketSubscribers } from '@/lib/subscribers'
import { cached } from '@/lib/cache'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * 盘后总结 cron — 一天跑一次（建议 16:10 北京时间，收盘后留 10 分钟数据稳定）
 * 内容只生成一份，发给所有 postmarket 订阅者。
 *
 * 测试触发：GET /api/cron/postmarket?test=1
 *   不需要 secret，仅发给 DEFAULT_TO_EMAIL
 *
 * 生产触发：GET /api/cron/postmarket?secret=$CRON_SECRET
 *   发给所有订阅者 + DEFAULT_TO_EMAIL
 */
export async function GET(req: NextRequest) {
  const test = req.nextUrl.searchParams.get('test') === '1'

  if (!test) {
    const secret = req.nextUrl.searchParams.get('secret')
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    // 缓存当日报告 6 小时 — 只生成一次，所有人共用同一份
    const today = new Date().toISOString().slice(0, 10)
    const { text, newsCount, modelUsed } = await cached(
      `postmarket:${today}`,
      generatePostmarketReport,
      { ttl: 6 * 3600 * 1000 },
    )
    const subject = `📊 A股盘后日报 ${new Date().toLocaleDateString('zh-CN')}${test ? '（测试）' : ''}`

    let recipients: string[] = []
    if (test) {
      const to = process.env.DEFAULT_TO_EMAIL
      if (!to) return NextResponse.json({ error: 'DEFAULT_TO_EMAIL not set' }, { status: 500 })
      recipients = [to]
    } else {
      const subs = await getPostmarketSubscribers().catch(() => [])
      recipients = Array.from(new Set(subs))
    }

    const sent: string[] = []
    const errors: { email: string; error: string }[] = []
    for (const email of recipients) {
      try {
        // 每个收件人生成含个人化退订链接的 HTML
        await sendEmail({ to: email, subject, html: buildPostmarketEmailHtml(text, email) })
        sent.push(email)
      } catch (e) {
        errors.push({ email, error: String(e) })
      }
    }

    return NextResponse.json({
      ok: true,
      sentCount: sent.length,
      sent,
      errors,
      newsCount,
      modelUsed,
      previewText: text.slice(0, 300),
    })
  } catch (err) {
    console.error('[postmarket cron]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
