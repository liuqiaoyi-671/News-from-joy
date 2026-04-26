import { Resend } from 'resend'

let _resend: Resend | null = null
function getClient() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const resend = getClient()
  const from = process.env.FROM_EMAIL || 'onboarding@resend.dev'
  const result = await resend.emails.send({ from, to, subject, html })
  // Resend SDK 不会 throw — 必须显式检查 error 字段
  if (result.error) {
    const msg = `Resend send failed: ${result.error.name || ''} — ${result.error.message || JSON.stringify(result.error)}`
    console.error('[email]', msg, { to, from })
    throw new Error(msg)
  }
  console.log('[email] sent', { to, id: (result.data as { id?: string } | null)?.id })
  return result
}

export function buildEmailHtml(title: string, content: string, type: 'premarket' | 'postmarket'): string {
  const emoji = type === 'premarket' ? '🌅' : '📊'
  const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, sans-serif; background: #0d0d0d; color: #e5e7eb; margin: 0; padding: 20px; }
  .container { max-width: 640px; margin: 0 auto; }
  .header { background: #161616; border: 1px solid #2a2a2a; border-radius: 10px; padding: 24px; margin-bottom: 16px; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
  .header p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
  .content { background: #161616; border: 1px solid #2a2a2a; border-radius: 10px; padding: 24px; }
  .content p { line-height: 1.7; margin: 0 0 12px; }
  a { color: #3b82f6; }
  .footer { text-align: center; color: #4b5563; font-size: 12px; margin-top: 20px; }
  pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${emoji} ${title}</h1>
    <p>${dateStr}</p>
  </div>
  <div class="content">
    <pre>${content}</pre>
  </div>
  <div class="footer">由市场仪表盘自动生成 · AI 内容仅供参考，不构成投资建议</div>
</div>
</body>
</html>`
}
