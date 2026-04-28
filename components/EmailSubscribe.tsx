'use client'
import { useState } from 'react'
import { Mail, CheckCircle, Loader2, Clock, BarChart3, Sunrise } from 'lucide-react'

const DELIVERY_TIMES = [
  { value: '730', label: '07:30' },
  { value: '800', label: '08:00' },
  { value: '830', label: '08:30' },
]

export default function EmailSubscribe() {
  const [email, setEmail] = useState('')
  const [wantsPremarket, setWantsPremarket] = useState(true)
  const [deliveryTime, setDeliveryTime] = useState('800')
  const [wantsPostmarket, setWantsPostmarket] = useState(true)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!wantsPremarket && !wantsPostmarket) {
      setStatus('error')
      setMsg('请至少选择一项订阅')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          deliveryTime: wantsPremarket ? deliveryTime : 'none',
          wantsPostmarket,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('ok')
        const parts: string[] = []
        if (wantsPremarket) parts.push(`盘前 ${DELIVERY_TIMES.find(t => t.value === deliveryTime)?.label}`)
        if (wantsPostmarket) parts.push('盘后 16:10')
        setMsg(`订阅成功！${parts.join(' + ')}`)
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

  // 折叠态：只显示一个按钮，点开展开完整表单（避免 Nav 拥挤）
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-bg-card hover:bg-border border border-border rounded-lg text-sm text-gray-300 flex items-center gap-2 transition-colors"
      >
        <Mail size={14} />
        邮箱订阅
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 flex-wrap justify-end">
      <div className="relative">
        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          autoFocus
          className="pl-8 pr-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent w-48"
        />
      </div>

      {/* 盘前 */}
      <label className={`flex items-center gap-1.5 px-2.5 py-2 border rounded-lg text-xs cursor-pointer transition-colors ${
        wantsPremarket ? 'bg-accent/15 border-accent text-gray-100' : 'bg-bg-card border-border text-gray-400 hover:text-gray-200'
      }`}>
        <input type="checkbox" checked={wantsPremarket} onChange={e => setWantsPremarket(e.target.checked)} className="accent-accent w-3 h-3" />
        <Sunrise size={12} />
        盘前
        {wantsPremarket && (
          <select
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="ml-1 bg-transparent border-0 text-xs text-gray-200 focus:outline-none cursor-pointer"
          >
            {DELIVERY_TIMES.map(t => (
              <option key={t.value} value={t.value} className="bg-bg-card">{t.label}</option>
            ))}
          </select>
        )}
      </label>

      {/* 盘后 */}
      <label className={`flex items-center gap-1.5 px-2.5 py-2 border rounded-lg text-xs cursor-pointer transition-colors ${
        wantsPostmarket ? 'bg-accent/15 border-accent text-gray-100' : 'bg-bg-card border-border text-gray-400 hover:text-gray-200'
      }`}>
        <input type="checkbox" checked={wantsPostmarket} onChange={e => setWantsPostmarket(e.target.checked)} className="accent-accent w-3 h-3" />
        <BarChart3 size={12} />
        盘后 16:10
      </label>

      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-4 py-2 bg-accent hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors flex items-center gap-1.5"
      >
        {status === 'loading' && <Loader2 size={13} className="animate-spin" />}
        订阅
      </button>
      {status === 'error' && <span className="text-down text-xs basis-full text-right">{msg}</span>}
    </form>
  )
}
