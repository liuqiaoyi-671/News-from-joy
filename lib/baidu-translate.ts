/**
 * 百度翻译开放平台 — 通用翻译 API
 * 文档：https://fanyi-api.baidu.com/doc/21
 *
 * 环境变量：
 *   BAIDU_TRANSLATE_APP_ID   — 在百度翻译开放平台注册后获得的 APP ID
 *   BAIDU_TRANSLATE_SECRET   — 对应的密钥
 *
 * 免费额度：新用户每月 200万字符（30天），之后 5万字符/月（标准版）
 * 注册入口：https://fanyi-api.baidu.com/api
 */

import { createHash } from 'crypto'

const APP_ID = process.env.BAIDU_TRANSLATE_APP_ID || ''
const SECRET  = process.env.BAIDU_TRANSLATE_SECRET  || ''

function md5(s: string): string {
  return createHash('md5').update(s, 'utf8').digest('hex')
}

/**
 * 将多个英文文本翻译为中文。
 * - 单次批量翻译，用 \n 分隔后合并发送，避免频繁请求
 * - 若 API 未配置，原样返回
 * - 失败时原样返回（不抛出）
 */
export async function translateToZH(texts: string[]): Promise<string[]> {
  if (!APP_ID || !SECRET) return texts
  if (!texts.length) return texts

  // 百度 API 单次最大 6000 字节；新闻标题通常不超限，直接批量
  const q = texts.join('\n')
  const salt = Date.now().toString()
  const sign = md5(APP_ID + q + salt + SECRET)

  const params = new URLSearchParams({ q, from: 'en', to: 'zh', appid: APP_ID, salt, sign })

  try {
    const res = await fetch(
      `https://fanyi-api.baidu.com/api/trans/vip/translate?${params}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data: {
      trans_result?: { src: string; dst: string }[]
      error_code?: string
      error_msg?: string
    } = await res.json()

    if (data.error_code) {
      console.warn('[baidu-translate] API error', data.error_code, data.error_msg)
      return texts
    }

    const results = data.trans_result || []
    // 结果按序与输入对齐
    return texts.map((orig, i) => results[i]?.dst || orig)
  } catch (e) {
    console.warn('[baidu-translate] fetch failed:', e)
    return texts
  }
}

/** 单条文本翻译（内部复用批量接口） */
export async function translateOne(text: string): Promise<string> {
  const [result] = await translateToZH([text])
  return result
}

/** 是否已配置百度翻译 API */
export function isBaiduTranslateEnabled(): boolean {
  return Boolean(process.env.BAIDU_TRANSLATE_APP_ID && process.env.BAIDU_TRANSLATE_SECRET)
}
