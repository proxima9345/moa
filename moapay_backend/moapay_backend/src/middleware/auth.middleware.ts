import type { FastifyRequest, FastifyReply } from 'fastify'
import { getUserByApiKey } from '../services/auth.service'

// JWT 인증 (대시보드, 앱)
export async function requireJwt(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'unauthorized', message: '로그인이 필요합니다.' })
  }
}

// API Key 인증 (서버-to-서버)
export async function requireApiKey(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization ?? ''
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!apiKey) {
    return reply.code(401).send({
      error: 'missing_api_key',
      message: 'Authorization: Bearer moa_live_... 헤더가 필요합니다.',
    })
  }

  const user = await getUserByApiKey(apiKey)
  if (!user) {
    return reply.code(401).send({
      error: 'invalid_api_key',
      message: '유효하지 않은 API 키입니다. 대시보드에서 키를 확인하세요.',
    })
  }

  // req에 user 주입
  ;(req as any).apiUser = user
}

// 웹훅 서명 검증
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const crypto = require('crypto')
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )
}
