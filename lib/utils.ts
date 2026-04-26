export function parseDate(s: string): Date {
  if (!s) return new Date(0)
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000)
  if (/^\d{13}$/.test(s)) return new Date(Number(s))
  const d = new Date(s.replace(' ', 'T'))
  return isNaN(d.getTime()) ? new Date(0) : d
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  if (/前$|刚刚/.test(dateStr)) return dateStr
  const date = parseDate(dateStr)
  if (!date || date.getTime() === 0) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 0) return '刚刚'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h > 48) return `${Math.floor(h / 24)}天前`
  if (h > 0) return `${h}小时前`
  return `${Math.max(m, 1)}分钟前`
}
