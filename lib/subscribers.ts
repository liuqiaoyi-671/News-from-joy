import { Resend } from 'resend'
import fs from 'fs'
import path from 'path'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!)
  return _resend
}

const AUDIENCE_NAME = '市场仪表盘订阅'
let _cachedAudienceId: string | null = null

/**
 * 确保 Resend Audience 存在；首次调用会自动创建并把 ID 写入 .env.local。
 * 返回 audience ID（无则 null）。
 */
export async function ensureAudienceId(): Promise<string | null> {
  if (_cachedAudienceId) return _cachedAudienceId
  if (process.env.RESEND_AUDIENCE_ID) {
    _cachedAudienceId = process.env.RESEND_AUDIENCE_ID
    return _cachedAudienceId
  }
  if (!process.env.RESEND_API_KEY) return null

  try {
    const resend = getResend()
    // 先查现有 audiences
    const list = await resend.audiences.list()
    type AudienceRow = { id: string; name?: string }
    const existing = (list.data as { data?: AudienceRow[] })?.data?.find(
      (a) => a.name === AUDIENCE_NAME,
    )
    if (existing) {
      _cachedAudienceId = existing.id
      persistAudienceId(existing.id)
      return existing.id
    }
    // 不存在则创建
    const created = await resend.audiences.create({ name: AUDIENCE_NAME })
    const newId = (created.data as { id?: string })?.id
    if (newId) {
      _cachedAudienceId = newId
      persistAudienceId(newId)
      return newId
    }
  } catch (err) {
    console.error('[subscribers] ensureAudienceId failed:', err)
  }
  return null
}

/** 把 audience ID 写到 .env.local（仅本地 dev；生产环境用 vercel env 设置） */
function persistAudienceId(id: string) {
  process.env.RESEND_AUDIENCE_ID = id
  if (process.env.VERCEL) return  // Vercel 上无法写文件，靠用户手动 vercel env add
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    let content = ''
    if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, 'utf8')
    if (content.includes('RESEND_AUDIENCE_ID=')) {
      content = content.replace(/RESEND_AUDIENCE_ID=.*/g, `RESEND_AUDIENCE_ID=${id}`)
    } else {
      content += (content.endsWith('\n') ? '' : '\n') + `RESEND_AUDIENCE_ID=${id}\n`
    }
    fs.writeFileSync(envPath, content)
    console.log(`[subscribers] persisted RESEND_AUDIENCE_ID=${id} to .env.local`)
  } catch (err) {
    console.warn('[subscribers] could not persist audience ID:', err)
  }
}

export interface Subscriber {
  email: string
  /** "730" | "800" | "830" — 偏好的简报推送时间 */
  deliveryTime: string
  unsubscribed: boolean
}

/** 订阅一位邮箱（已存在则更新偏好） */
export async function addSubscriber(email: string, deliveryTime: string): Promise<void> {
  const audienceId = await ensureAudienceId()
  if (!audienceId) throw new Error('Resend audience 不可用')
  const resend = getResend()
  // Resend create 是 upsert：同 email 重复创建不会报错而是更新
  await resend.contacts.create({
    audienceId,
    email,
    firstName: deliveryTime,
    unsubscribed: false,
  })
}

/** 列出此时间段（"730"/"800"/"830"）所有活跃订阅者邮箱 */
export async function getSubscribersByTime(time: string): Promise<string[]> {
  const audienceId = await ensureAudienceId()
  if (!audienceId) return []
  const resend = getResend()
  const { data } = await resend.contacts.list({ audienceId })
  type Row = { email: string; first_name?: string; unsubscribed?: boolean }
  const rows = (data as { data?: Row[] })?.data || []
  return rows
    .filter((r) => !r.unsubscribed)
    .filter((r) => (r.first_name || '800') === time)
    .map((r) => r.email)
}
