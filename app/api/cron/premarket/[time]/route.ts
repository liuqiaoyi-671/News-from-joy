import { NextRequest, NextResponse } from 'next/server'
import { generatePremarketBriefing, buildBriefingEmailHtml } from '@/lib/briefing'
import { sendEmail } from '@/lib/email'
import { getSubscribersByTime } from '@/lib/subscribers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_TIMES = new Set(['730', '800', '830', 'test'])

export async function GET(
  req: NextRequest,
  { params }: { params: { time: string } },
) {
  const time = params.time
  if (!VALID_TIMES.has(time)) {
    return NextResponse.json({ error: 'invalid time slot' }, { status: 400 })
  }

  // 测试模式：仅发给 DEFAULT_TO_EMAIL
  const isTest = time === 'test'

  // 鉴权（fail-closed：CRON_SECRET 未设置时拒绝所有非 test 请求）
  if (!isTest) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('[premarket cron] CRON_SECRET is not set — refusing request')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const authHeader = req.headers.get('authorization')
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (bearer !== cronSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const { text } = await generatePremarketBriefing()
    const subject = `🌅 盘前简报 ${new Date().toLocaleDateString('zh-CN')}${isTest ? '（测试）' : ''}`

    let sentCount = 0
    let failCount = 0

    if (isTest) {
      const to = process.env.DEFAULT_TO_EMAIL
      if (!to) return NextResponse.json({ error: 'DEFAULT_TO_EMAIL not set' }, { status: 500 })
      try {
        await sendEmail({ to, subject, html: buildBriefingEmailHtml(text, to) })
        sentCount++
      } catch (e) {
        console.error('[premarket cron] test send failed:', e)
        failCount++
      }
    } else {
      const subscribers = await getSubscribersByTime(time).catch(() => [])
      for (const email of subscribers) {
        try {
          await sendEmail({ to: email, subject, html: buildBriefingEmailHtml(text, email) })
          sentCount++
        } catch (e) {
          console.error('[premarket cron] send failed for subscriber:', e)
          failCount++
        }
      }
    }

    return NextResponse.json({ ok: true, time, sentCount, failCount, status: 'done' })
  } catch (err) {
    console.error('[premarket cron]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
