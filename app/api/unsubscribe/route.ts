import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken, unsubscribeContact } from '@/lib/subscribers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/unsubscribe?e=<base64url email>&t=<hmac token>
 *
 * 点击邮件中的退订链接后直接在此处理，完成后重定向到展示页。
 * token = HMAC-SHA256(email, CRON_SECRET) — 防止第三方随意退订他人邮箱。
 */
export async function GET(req: NextRequest) {
  const siteBase =
    process.env.SITE_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const e = req.nextUrl.searchParams.get('e')
  const t = req.nextUrl.searchParams.get('t')

  if (!e || !t) {
    return NextResponse.redirect(`${siteBase}/unsubscribe?status=invalid`)
  }

  let email: string
  try {
    email = Buffer.from(e, 'base64url').toString('utf8')
    if (!email || !email.includes('@')) throw new Error('bad email')
  } catch {
    return NextResponse.redirect(`${siteBase}/unsubscribe?status=invalid`)
  }

  if (!verifyUnsubscribeToken(email, t)) {
    return NextResponse.redirect(`${siteBase}/unsubscribe?status=invalid`)
  }

  try {
    await unsubscribeContact(email)
    console.log('[unsubscribe] removed:', email)
    return NextResponse.redirect(`${siteBase}/unsubscribe?status=ok&email=${encodeURIComponent(email)}`)
  } catch (err) {
    console.error('[unsubscribe] failed:', err)
    return NextResponse.redirect(`${siteBase}/unsubscribe?status=error`)
  }
}
