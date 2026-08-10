'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    TradingView: {
      widget: new (config: Record<string, unknown>) => void
    }
  }
}

interface Props {
  symbol?: string
  height?: number
}

// 全局只加载一次 TV 脚本
let tvScriptReady = false
const tvReadyCallbacks: (() => void)[] = []

function ensureTVScript(cb: () => void) {
  if (tvScriptReady) { cb(); return }
  tvReadyCallbacks.push(cb)
  if (document.querySelector('script[data-tv]')) return   // 正在加载中
  const s = document.createElement('script')
  s.src = 'https://s3.tradingview.com/tv.js'
  s.async = true
  s.setAttribute('data-tv', '1')
  s.onload = () => {
    tvScriptReady = true
    tvReadyCallbacks.forEach(fn => fn())
    tvReadyCallbacks.length = 0
  }
  document.head.appendChild(s)
}

export default function TradingViewChart({ symbol = 'SSE:000300', height = 440 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wrapRef.current) return
    // 生成唯一容器 ID（同一页面多个图表互不干扰）
    const cid = `tv_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`
    wrapRef.current.innerHTML = `<div id="${cid}" style="height:${height}px;width:100%"></div>`

    ensureTVScript(() => {
      if (!document.getElementById(cid)) return
      new window.TradingView.widget({
        container_id: cid,
        autosize: true,
        height,
        symbol,
        interval: 'D',
        timezone: 'Asia/Shanghai',
        theme: 'dark',
        style: '1',
        locale: 'zh_CN',
        toolbar_bg: '#0f1117',
        enable_publishing: false,
        allow_symbol_change: true,
        save_image: false,
        hide_side_toolbar: false,
        withdateranges: true,
        studies: [],
      })
    })

    return () => {
      if (wrapRef.current) wrapRef.current.innerHTML = ''
    }
  }, [symbol, height])

  return (
    <div
      ref={wrapRef}
      style={{ height, minHeight: height }}
      className="w-full"
    />
  )
}
