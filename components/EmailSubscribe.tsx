'use client'
import { useState } from 'react'
import { Mail, CheckCircle, Loader2, Clock } from 'lucide-react'

const DELIVERY_TIMES = [
  { value: '730', label: '07:30' },
  { value: '800', label: '08:00' },
  { value: '830', label: '08:30' },
]

export default function EmailSubscribe() {
  const [email, setEmail] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('800')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, deliveryTime }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('ok')
        setMsg(`订阅成功！将于每日 ${DELIVERY_TIMES.find(t => t.value === deliveryTime)?.label} 发送`)
      } else {
        setStatus('error')
        setMsg(data.error || '订阅失败，请稍后重试')
      }
    } catch {
      setStatus('error')
      setMsg('网络错误，请稍后重试')
    }
  }

  if (status === 'ok') {
    return (
      <div className="flex items-center gap-2 text-up text-sm">
        <CheckCircle size={16} />
        {msg}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <div className="relative">
        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱订阅盘前简报"
          className="pl-8 pr-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent w-52"
        />
      </div>
      <div className="relative">
        <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <select
          value={deliveryTime}
          onChange={(e) => setDeliveryTime(e.target.value)}
          className="pl-7 pr-6 py-2 bg-bg-card border border-border rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent appearance-none cursor-pointer"
        >
          {DELIVERY_TIMES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-4 py-2 bg-accent hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5"
      >
        {status === 'loading' && <Loader2 size={13} className="animate-spin" />}
        订阅
      </button>
      {status === 'error' && <span className="text-down text-xs">{msg}</span>}
    </form>
  )
}
