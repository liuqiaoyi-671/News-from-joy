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

  // 测试模式：仅发给 DEFAULT_TO_EMAIL，无需 secret，便于本地点击触发
  const isTest = time === 'test'

  // 鉴权（生产 cron 必须带 secret；test 模式跳过）
  if (!isTest) {
    const secret = req.nextUrl.searchParams.get('secret')
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    const { text } = await generatePremarketBriefing()
    const html = buildBriefingEmailHtml(text)
    const subject = `🌅 盘前简报 ${new Date().toLocaleDateString('zh-CN')}${isTest ? '（测试）' : ''}`

    const sent: string[] = []
    const errors: { email: string; error: string }[] = []

    if (isTest) {
      // 仅发给默认测试邮箱
      const to = process.env.DEFAULT_TO_EMAIL
      if (!to) return NextResponse.json({ error: 'DEFAULT_TO_EMAIL not set' }, { status: 500 })
      try { await sendEmail({ to, subject, html }); sent.push(to) }
      catch (e) { errors.push({ email: to, error: String(e) }) }
    } else {
      // 真实 cron：发给该时间段所有订阅者
      const subscribers = await getSubscribersByTime(time).catch(() => [])
      // 同时把 DEFAULT_TO_EMAIL 也加进去，确保至少有一封
      const defaultTo = process.env.DEFAULT_TO_EMAIL
      const all = new Set(subscribers)
      if (defaultTo && time === '800') all.add(defaultTo)  // 默认 8:00 收

      for (const email of all) {
        try { await sendEmail({ to: email, subject, html }); sent.push(email) }
        catch (e) { errors.push({ email, error: String(e) }) }
      }
    }

    return NextResponse.json({
      ok: true, time, sentCount: sent.length, sent, errors,
      previewText: text.slice(0, 200),
    })
  } catch (err) {
    console.error('[premarket cron]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
