// 简单的 in-memory TTL 缓存。
// Next.js dev 模式下每次 hot reload 会重置；生产模式下 Lambda 实例间不共享。
// 用途：吸收资讯/行情接口的高频访问，TTL 短到不影响时效性即可。

interface CacheEntry<T> {
  value: T
  expiresAt: number
  inFlight?: Promise<T>  // 进行中的请求，避免缓存击穿
}

const store = new Map<string, CacheEntry<unknown>>()

export interface CacheOptions {
  /** TTL，单位毫秒。默认 60 秒 */
  ttl?: number
  /** 跳过缓存（强制刷新） */
  fresh?: boolean
}

/**
 * 包装一个异步函数：先查缓存，未命中则调用 producer 并缓存结果。
 * 同 key 并发请求会复用同一个 in-flight Promise，避免雪崩。
 */
export async function cached<T>(
  key: string,
  producer: () => Promise<T>,
  opts: CacheOptions = {}
): Promise<T> {
  const ttl = opts.ttl ?? 60_000
  const now = Date.now()

  if (!opts.fresh) {
    const entry = store.get(key) as CacheEntry<T> | undefined
    if (entry) {
      // 进行中：等同一个 promise
      if (entry.inFlight) return entry.inFlight
      // 命中且未过期
      if (entry.expiresAt > now) return entry.value
    }
  }

  const promise = (async () => {
    try {
      const value = await producer()
      store.set(key, { value, expiresAt: Date.now() + ttl })
      return value
    } catch (err) {
      // 失败不缓存（让下次请求重试）
      store.delete(key)
      throw err
    }
  })()

  store.set(key, { value: undefined as T, expiresAt: 0, inFlight: promise })
  return promise
}

export function invalidate(prefix?: string) {
  if (!prefix) { store.clear(); return }
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k)
}

export function cacheStats() {
  const now = Date.now()
  let total = 0, valid = 0, inFlight = 0
  for (const [, e] of store) {
    total++
    if (e.inFlight) inFlight++
    else if (e.expiresAt > now) valid++
  }
  return { total, valid, inFlight }
}
