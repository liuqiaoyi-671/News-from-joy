import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { addSubscriber, buildUnsubscribeUrl } from '@/lib/subscribers'

const TIME_LABELS: Record<string, string> = {
  '730': '07:30',
  '800': '08:00',
  '830': '08:30',
  'none': '不订阅',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const email: string = body.email
  // 兼容老前端：deliveryTime 缺省时默认 800
  const deliveryTime: string = body.deliveryTime ?? '800'
  // 默认不订阅盘后（未传该字段时维持原行为）
  const wantsPostmarket: boolean = !!body.wantsPostmarket

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
  }
  if (!TIME_LABELS[deliveryTime]) {
    return NextResponse.json({ error: '无效的盘前接收时间' }, { status: 400 })
  }
  // 至少订阅一项
  if (deliveryTime === 'none' && !wantsPostmarket) {
    return NextResponse.json({ error: '请至少选择一项订阅（盘前或盘后）' }, { status: 400 })
  }

  const wantsPremarket = deliveryTime !== 'none'
  const timeLabel = TIME_LABELS[deliveryTime]

  try {
    // ── 1. 加入订阅者列表 ─────────────────────────────────────────────────
    let saved = false
    try {
      await addSubscriber(email, { deliveryTime, wantsPostmarket })
      saved = true
    } catch (err) {
      console.warn('[subscribe] addSubscriber failed (continuing):', err)
    }

    // ── 2. 发送确认邮件 ───────────────────────────────────────────────────
    const items: string[] = []
    if (wantsPremarket) {
      items.push(`<li>🌅 <strong>盘前简报</strong>：每个交易日 <strong style="color:#3b82f6">${timeLabel}（北京时间）</strong></li>`)
    }
    if (wantsPostmarket) {
      items.push(`<li>📊 <strong>盘后日报</strong>：每个交易日 <strong style="color:#3b82f6">16:10（北京时间）</strong></li>`)
    }

    await sendEmail({
      to: email,
      subject: '✅ 市场仪表盘订阅成功',
      html: `<div style="font-family:sans-serif;color:#e5e7eb;background:#0d0d0d;padding:24px;border-radius:10px;max-width:560px">
        <h2 style="color:#3b82f6;margin:0 0 12px">订阅成功！</h2>
        <p style="margin:0 0 10px">您的邮箱 <strong>${email}</strong> 已成功订阅市场仪表盘服务。</p>
        <p style="margin:0 0 6px">您将收到：</p>
        <ul style="margin:8px 0 16px;padding-left:20px;line-height:1.9">
          ${items.join('\n          ')}
        </ul>
        <p style="margin:8px 0 4px;font-size:13px;color:#9ca3af">盘前简报涵盖：今日核心要闻、宏观资金面、行业与公司信号、海外大宗、盘前一句话结论</p>
        <p style="margin:4px 0 12px;font-size:13px;color:#9ca3af">盘后日报涵盖：市场运行情况、大盘驱动因素、行业涨跌归因、机构后市观点（DeepSeek 模型撰写）</p>
        <p style="color:#6b7280;font-size:12px;margin:0">AI 内容仅供参考，不构成投资建议</p>
        <p style="color:#4b5563;font-size:11px;margin:8px 0 0">
          <a href="${buildUnsubscribeUrl(email)}" style="color:#4b5563;text-decoration:underline">退订</a>
        </p>
      </div>`,
    })

    return NextResponse.json({ ok: true, saved, wantsPremarket, wantsPostmarket })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
