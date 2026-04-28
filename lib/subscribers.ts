import { Resend } from 'resend'
import { createHmac } from 'crypto'
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
  /** "730" | "800" | "830" — 盘前推送时间，"none"=不订阅盘前 */
  deliveryTime: string
  /** 是否订阅盘后日报（每日 16:10 一次） */
  wantsPostmarket: boolean
  unsubscribed: boolean
}

/**
 * 订阅一位邮箱（已存在则更新偏好）
 *
 * Resend Contact 字段映射：
 *   firstName  → 盘前时间偏好（"730"/"800"/"830"/"none"）
 *   lastName   → 盘后偏好（"post" 或空）
 */
export async function addSubscriber(
  email: string,
  opts: { deliveryTime?: string; wantsPostmarket?: boolean } = {},
): Promise<void> {
  const audienceId = await ensureAudienceId()
  if (!audienceId) throw new Error('Resend audience 不可用')
  const resend = getResend()
  await resend.contacts.create({
    audienceId,
    email,
    firstName: opts.deliveryTime || 'none',
    lastName: opts.wantsPostmarket ? 'post' : '',
    unsubscribed: false,
  })
}

type ContactRow = {
  email: string
  first_name?: string
  last_name?: string
  unsubscribed?: boolean
}

async function listAllContacts(): Promise<ContactRow[]> {
  const audienceId = await ensureAudienceId()
  if (!audienceId) return []
  const resend = getResend()
  const { data } = await resend.contacts.list({ audienceId })
  return ((data as { data?: ContactRow[] })?.data || []).filter(r => !r.unsubscribed)
}

/** 列出此时间段（"730"/"800"/"830"）订阅了【盘前】简报的邮箱 */
export async function getSubscribersByTime(time: string): Promise<string[]> {
  const rows = await listAllContacts()
  return rows
    .filter(r => (r.first_name || 'none') === time)
    .map(r => r.email)
}

/** 列出所有订阅了【盘后】日报的邮箱（每天统一发一次，无时间分流） */
export async function getPostmarketSubscribers(): Promise<string[]> {
  const rows = await listAllContacts()
  return rows
    .filter(r => (r.last_name || '') === 'post')
    .map(r => r.email)
}

// ── 退订 ───────────────────────────────────────────────────────────────────────

/**
 * 退订某邮箱：在 Resend audience 中将其标记为 unsubscribed。
 * 使用 upsert（contacts.create with unsubscribed:true）避免需要先查 contactId。
 */
export async function unsubscribeContact(email: string): Promise<void> {
  const audienceId = await ensureAudienceId()
  if (!audienceId) throw new Error('Resend audience 不可用')
  const resend = getResend()
  await resend.contacts.create({ audienceId, email, unsubscribed: true })
}

// ── 退订链接生成 ───────────────────────────────────────────────────────────────

/** 用 CRON_SECRET 对 email 做 HMAC-SHA256，生成 URL 安全令牌 */
export function signUnsubscribeToken(email: string): string {
  const secret = process.env.CRON_SECRET || 'unsub-secret'
  return createHmac('sha256', secret).update(email).digest('base64url')
}

/** 验证退订令牌（时间无关，只要 secret 一致即可） */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  return signUnsubscribeToken(email) === token
}

/** 构造个人化退订链接，嵌入所有发出的邮件 */
export function buildUnsubscribeUrl(email: string): string {
  const base =
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001')
  const e = Buffer.from(email).toString('base64url')
  const t = signUnsubscribeToken(email)
  return `${base}/api/unsubscribe?e=${e}&t=${t}`
}
