import axios from 'axios'

/**
 * DeepSeek Chat Completions（OpenAI 兼容协议）
 * 文档：https://api-docs.deepseek.com/
 *
 * 模型选择：
 * - deepseek-chat：通用对话（V3.x），适合长文写作、综合分析
 * - deepseek-reasoner：推理模型（R1），更强的逻辑分析、归因，但更慢
 *
 * 盘后总结使用 deepseek-reasoner 以保证归因质量。
 */
const ENDPOINT = 'https://api.deepseek.com/chat/completions'

interface ChatOptions {
  model?: 'deepseek-chat' | 'deepseek-reasoner'
  temperature?: number
  maxTokens?: number
  retries?: number
}

export async function chat(prompt: string, opts: ChatOptions = {}): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY not configured')

  const model = opts.model || 'deepseek-chat'
  const retries = opts.retries ?? 2
  let lastErr: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(
        ENDPOINT,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 4096,
          stream: false,
        },
        {
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          timeout: 120_000,
        },
      )
      const text = res.data?.choices?.[0]?.message?.content
      if (text) return text
      lastErr = new Error('empty response from DeepSeek')
    } catch (err) {
      lastErr = err
      const status = (err as { response?: { status?: number } })?.response?.status
      // 4xx 鉴权类不重试（429 除外）
      if (status && status >= 400 && status < 500 && status !== 429) throw err
    }
    if (attempt < retries) {
      const wait = 1500 * Math.pow(2, attempt)  // 1.5s / 3s / 6s
      console.warn(`[deepseek] retry ${attempt + 1}/${retries} after ${wait}ms`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}
