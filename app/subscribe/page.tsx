'use client'
import { useState } from 'react'
import { Mail, Loader2, CheckCircle, XCircle, Sunrise, BarChart3 } from 'lucide-react'

interface Subscriber {
  email: string
  deliveryTime: string   // '730' | '800' | '830' | 'none'
  wantsPostmarket: boolean
  unsubscribed: boolean
}

const DELIVERY_TIMES = [
  { value: '730', label: '07:30' },
  { value: '800', label: '08:00' },
  { value: '830', label: '08:30' },
]

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'
type SaveStatus   = 'idle' | 'loading' | 'ok' | 'error'

export default function SubscribePage() {
  const [emailInput,   setEmailInput]   = useState('')
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [subscriber,   setSubscriber]   = useState<Subscriber | null>(null)

  // 表单状态
  const [wantsPremarket,  setWantsPremarket]  = useState(true)
  const [deliveryTime,    setDeliveryTime]    = useState('800')
  const [wantsPostmarket, setWantsPostmarket] = useState(true)
  const [saveStatus,      setSaveStatus]      = useState<SaveStatus>('idle')
  const [saveMsg,         setSaveMsg]         = useState('')

  // ── 查询已有订阅 ──────────────────────────────────────────────────────────
  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    setLookupStatus('loading')
    setSaveStatus('idle')
    try {
      const res  = await fetch(`/api/subscribe?email=${encodeURIComponent(email)}`)
      const data = await res.json()
      if (!res.ok) { setLookupStatus('error'); return }
      if (data.found) {
        setLookupStatus('found')
        setSubscriber(data.subscriber)
        const dt = data.subscriber.deliveryTime || 'none'
        setWantsPremarket(dt !== 'none')
        setDeliveryTime(dt !== 'none' ? dt : '800')
        setWantsPostmarket(data.subscriber.wantsPostmarket)
      } else {
        setLookupStatus('not_found')
        setSubscriber(null)
        setWantsPremarket(true); setDeliveryTime('800'); setWantsPostmarket(true)
      }
    } catch {
      setLookupStatus('error')
    }
  }

  // ── 保存 / 新建订阅 ────────────────────────────────────────────────────────
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!wantsPremarket && !wantsPostmarket) {
      setSaveStatus('error'); setSaveMsg('请至少选择一项'); return
    }
    setSaveStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          deliveryTime: wantsPremarket ? deliveryTime : 'none',
          wantsPostmarket,
        }),
      })
      if (res.ok) {
        setSaveStatus('ok')
        setSaveMsg(lookupStatus === 'not_found' ? '订阅成功！确认邮件已发送' : '偏好已更新！')
        setLookupStatus('found')
      } else {
        const d = await res.json()
        setSaveStatus('error'); setSaveMsg(d.error || '操作失败')
      }
    } catch {
      setSaveStatus('error'); setSaveMsg('网络错误，请稍后重试')
    }
  }

  // ── 退订 ──────────────────────────────────────────────────────────────────
  async function unsubscribe() {
    if (!confirm(`确认退订 ${emailInput.trim()}？`)) return
    setSaveStatus('loading')
    try {
      const res = await fetch(
        `/api/subscribe?email=${encodeURIComponent(emailInput.trim())}`,
        { method: 'DELETE' },
      )
      if (res.ok) {
        setSaveStatus('ok'); setSaveMsg('已退订')
        setLookupStatus('not_found'); setSubscriber(null)
      } else {
        setSaveStatus('error'); setSaveMsg('退订失败，请稍后重试')
      }
    } catch {
      setSaveStatus('error'); setSaveMsg('网络错误')
    }
  }

  const showForm = lookupStatus === 'found' || lookupStatus === 'not_found'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', padding: '32px 16px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>📧 订阅管理</h1>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>
          查询、修改偏好或退订邮件推送
        </p>

        {/* 邮箱查询 */}
        <form onSubmit={lookup} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input
              type="email"
              required
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px 10px 34px',
                background: '#161616', border: '1px solid #2a2a2a',
                borderRadius: 8, color: '#e5e7eb', fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={lookupStatus === 'loading'}
            style={{
              padding: '10px 18px', background: '#3b82f6', color: 'white',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: lookupStatus === 'loading' ? 0.7 : 1,
            }}
          >
            {lookupStatus === 'loading' && <Loader2 size={14} className="animate-spin" />}
            查询
          </button>
        </form>

        {/* 状态提示 */}
        {lookupStatus === 'error' && (
          <div style={{ padding: 12, background: '#3a0d0d', border: '1px solid #dc2626', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 14 }}>
            查询失败，请检查网络后重试
          </div>
        )}
        {lookupStatus === 'not_found' && (
          <div style={{ padding: 12, background: '#0f1f0f', border: '1px solid #16a34a', borderRadius: 8, color: '#86efac', fontSize: 13, marginBottom: 14 }}>
            该邮箱尚未订阅 — 填写下方偏好后点击订阅即可
          </div>
        )}
        {lookupStatus === 'found' && subscriber && (
          <div style={{ padding: 12, background: '#0d1a2e', border: '1px solid #1e40af', borderRadius: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#93c5fd', fontSize: 13, marginBottom: 4 }}>
              <CheckCircle size={14} /> 已找到订阅记录
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {subscriber.unsubscribed
                ? '状态：已退订'
                : [
                    subscriber.deliveryTime !== 'none' ? `盘前 ${DELIVERY_TIMES.find(t => t.value === subscriber.deliveryTime)?.label ?? subscriber.deliveryTime}` : null,
                    subscriber.wantsPostmarket ? '盘后 16:10' : null,
                  ].filter(Boolean).join(' · ') || '无订阅项目'}
            </div>
          </div>
        )}

        {/* 订阅 / 修改表单 */}
        {showForm && (
          <form onSubmit={save} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 10, padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#d1d5db' }}>
              {lookupStatus === 'not_found' ? '选择订阅项目' : '修改订阅偏好'}
            </h2>

            {/* 盘前 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
              <input
                type="checkbox" checked={wantsPremarket}
                onChange={e => setWantsPremarket(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#3b82f6', flexShrink: 0 }}
              />
              <Sunrise size={15} style={{ color: '#f97316', flexShrink: 0 }} />
              <span style={{ fontSize: 14, flex: 1 }}>盘前简报</span>
              {wantsPremarket && (
                <select
                  value={deliveryTime}
                  onChange={e => setDeliveryTime(e.target.value)}
                  style={{ background: '#1f1f1f', border: '1px solid #374151', borderRadius: 6, padding: '4px 8px', color: '#d1d5db', fontSize: 13 }}
                >
                  {DELIVERY_TIMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              )}
            </label>

            {/* 盘后 */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox" checked={wantsPostmarket}
                onChange={e => setWantsPostmarket(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#3b82f6', flexShrink: 0 }}
              />
              <BarChart3 size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
              <span style={{ fontSize: 14, flex: 1 }}>盘后日报</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>16:10</span>
            </label>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={saveStatus === 'loading'}
                style={{
                  padding: '9px 20px', background: '#3b82f6', color: 'white',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: saveStatus === 'loading' ? 0.7 : 1,
                }}
              >
                {saveStatus === 'loading' && <Loader2 size={14} className="animate-spin" />}
                {lookupStatus === 'not_found' ? '立即订阅' : '保存修改'}
              </button>

              {lookupStatus === 'found' && subscriber && !subscriber.unsubscribed && (
                <button
                  type="button"
                  onClick={unsubscribe}
                  disabled={saveStatus === 'loading'}
                  style={{
                    padding: '9px 14px', background: 'transparent',
                    border: '1px solid #374151', borderRadius: 8,
                    cursor: 'pointer', fontSize: 13, color: '#6b7280',
                  }}
                >
                  退订
                </button>
              )}

              {saveStatus === 'ok' && (
                <span style={{ color: '#22c55e', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={14} /> {saveMsg}
                </span>
              )}
              {saveStatus === 'error' && (
                <span style={{ color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <XCircle size={14} /> {saveMsg}
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
