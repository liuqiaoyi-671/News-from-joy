import Link from 'next/link'

interface Props {
  searchParams: { status?: string; email?: string }
}

export default function UnsubscribePage({ searchParams }: Props) {
  const { status, email } = searchParams

  const content = (() => {
    switch (status) {
      case 'ok':
        return {
          icon: '✅',
          title: '退订成功',
          body: email
            ? `邮箱 ${email} 已退订，今后不会再收到市场仪表盘的邮件。`
            : '您已成功退订，今后不会再收到市场仪表盘的邮件。',
          sub: '如果是误操作，可以重新订阅。',
        }
      case 'invalid':
        return {
          icon: '⚠️',
          title: '链接无效',
          body: '退订链接已失效或格式不正确。',
          sub: '请在最新收到的邮件中点击退订链接，或联系我们处理。',
        }
      case 'error':
        return {
          icon: '❌',
          title: '操作失败',
          body: '退订时出现错误，请稍后重试。',
          sub: '如果问题持续，请回复邮件联系我们。',
        }
      default:
        return {
          icon: '📭',
          title: '退订中心',
          body: '请通过邮件中的退订链接访问此页面。',
          sub: '',
        }
    }
  })()

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="max-w-md w-full bg-bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        <div className="text-5xl">{content.icon}</div>
        <h1 className="text-xl font-bold text-gray-100">{content.title}</h1>
        <p className="text-gray-400 text-sm leading-relaxed">{content.body}</p>
        {content.sub && (
          <p className="text-gray-600 text-xs">{content.sub}</p>
        )}
        <div className="pt-2">
          <Link
            href="/news"
            className="inline-block px-5 py-2 bg-accent hover:bg-blue-500 text-white text-sm rounded-lg font-medium transition-colors"
          >
            返回首页
          </Link>
          {status === 'ok' && (
            <Link
              href="/"
              className="ml-3 inline-block px-5 py-2 border border-border text-gray-400 hover:text-gray-200 text-sm rounded-lg transition-colors"
            >
              重新订阅
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
