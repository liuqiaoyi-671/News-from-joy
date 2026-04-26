'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp } from 'lucide-react'
import EmailSubscribe from './EmailSubscribe'

export default function Navigation() {
  const path = usePathname()
  return (
    <header className="border-b border-border sticky top-0 z-20 bg-bg-primary/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" />
            <span className="font-bold text-base">市场仪表盘</span>
          </div>
          <nav className="flex gap-1">
            <Link
              href="/news"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                path === '/news' || path === '/'
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-bg-card'
              }`}
            >
              📰 资讯
            </Link>
          </nav>
        </div>
        <EmailSubscribe />
      </div>
    </header>
  )
}
