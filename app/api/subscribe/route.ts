import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { addSubscriber } from '@/lib/subscribers'

const TIME_LABELS: Record<string, string> = {
  '730': '07:30',
  '800': '08:00',
  '830': '08:30',
}

export async function POST(req: NextRequest) {
  const { email, deliveryTime = '800' } = await req.json()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
  }
  if (!TIME_LABELS[deliveryTime]) {
    return NextResponse.json({ error: '无效的接收时间' }, { status: 400 })
  }

  const timeLabel = TIME_LABELS[deliveryTime]

  try {
    // ── 1. 加入订阅者列表（auto-create audience on first run） ─────────────
    let saved = false
    try {
      await addSubscriber(email, deliveryTime)
      saved = true
    } catch (err) {
      console.warn('[subscribe] addSubscriber failed (continuing):', err)
    }

    // ── 2. 发送确认邮件 ───────────────────────────────────────────────────
    await sendEmail({
      to: email,
      subject: '✅ 市场仪表盘盘前简报订阅成功',
      html: `<div style="font-family:sans-serif;color:#e5e7eb;background:#0d0d0d;padding:24px;border-radius:10px;max-width:520px">
        <h2 style="color:#3b82f6;margin:0 0 12px">订阅成功！</h2>
        <p style="margin:0 0 10px">您的邮箱 <strong>${email}</strong> 已成功订阅市场仪表盘盘前简报。</p>
        <p style="margin:0 0 6px">您将在每个交易日 <strong style="color:#3b82f6">${timeLabel}（北京时间）</strong> 收到简报，包含：</p>
        <ul style="margin:8px 0 16px;padding-left:20px;line-height:1.8">
          <li>🔥 今日核心3条要闻</li>
          <li>📊 宏观与资金面动态</li>
          <li>🏭 行业与公司信号</li>
          <li>🌏 海外与大宗商品</li>
          <li>💡 盘前一句话结论</li>
        </ul>
        <p style="color:#6b7280;font-size:12px;margin:0">AI 内容仅供参考，不构成投资建议</p>
      </div>`,
    })

    return NextResponse.json({ ok: true, saved })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
