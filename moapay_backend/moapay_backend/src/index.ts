import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

import { runMigrations, checkDbHealth } from './db/client'
import { authRoutes } from './routes/auth.routes'
import { paymentRoutes } from './routes/payment.routes'
import { webhookRoutes } from './routes/webhook.routes'

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

async function bootstrap() {
  // ── 플러그인 ────────────────────────────────────────────────────────────────
  await app.register(helmet)
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://moapay.dev', /\.moapay\.dev$/]
      : true,
    credentials: true,
  })
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'rate_limit_exceeded',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
    }),
  })

  // ── 라우트 ──────────────────────────────────────────────────────────────────
  await app.register(authRoutes)
  await app.register(paymentRoutes)
  await app.register(webhookRoutes)

  // ── 헬스체크 ────────────────────────────────────────────────────────────────
  app.get('/health', async () => {
    const dbTime = await checkDbHealth()
    return { status: 'ok', db: dbTime, version: '1.0.0' }
  })

  // ── 전역 에러 핸들러 ────────────────────────────────────────────────────────
  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err)
    reply.code(err.statusCode ?? 500).send({
      error: 'internal_error',
      message: process.env.NODE_ENV === 'production'
        ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        : err.message,
    })
  })

  // ── DB 마이그레이션 ─────────────────────────────────────────────────────────
  await runMigrations()

  // ── 서버 시작 ───────────────────────────────────────────────────────────────
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`🚀 MoaPay API running on http://localhost:${port}`)
}

bootstrap().catch(err => {
  console.error('❌ Server failed to start:', err)
  process.exit(1)
})
