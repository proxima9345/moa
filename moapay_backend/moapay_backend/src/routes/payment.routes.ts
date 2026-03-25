import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireApiKey, requireJwt } from '../middleware/auth.middleware'
import * as paymentService from '../services/payment.service'

const createSchema = z.object({
  amount:         z.number().int().min(100, '최소 결제 금액은 100원입니다.'),
  currency:       z.enum(['KRW']).default('KRW'),
  method:         z.enum(['card','kakaopay','naverpay','tosspay','bank','phone','giftcard']),
  order_id:       z.string().max(100).optional(),
  customer_name:  z.string().optional(),
  customer_email: z.string().email().optional(),
  metadata:       z.record(z.unknown()).optional(),
})

const cancelSchema = z.object({
  amount: z.number().int().positive().optional(),
  reason: z.string().optional(),
})

export async function paymentRoutes(app: FastifyInstance) {

  // ── API Key 기반 (서버-to-서버) ──────────────────────────────────────────

  // POST /v1/payments — 결제 생성
  app.post('/v1/payments', { preHandler: requireApiKey }, async (req, reply) => {
    const user = (req as any).apiUser
    const body = createSchema.safeParse(req.body)

    if (!body.success) {
      return reply.code(400).send({
        error: 'validation_error',
        message: body.error.errors[0].message,
        details: body.error.errors,
      })
    }

    try {
      const payment = await paymentService.createPayment(
        user.id, user.plan, body.data,
        user.moa_api_key?.includes('live') ?? false
      )
      return reply.code(201).send(payment)
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({
        error: err.code ?? 'internal_error',
        message: err.message,
      })
    }
  })

  // GET /v1/payments — 결제 목록
  app.get('/v1/payments', { preHandler: requireApiKey }, async (req, reply) => {
    const user = (req as any).apiUser
    const { limit, offset, status } = req.query as any

    const result = await paymentService.listPayments(user.id, {
      limit:  Number(limit)  || 20,
      offset: Number(offset) || 0,
      status,
    })
    return reply.send(result)
  })

  // GET /v1/payments/:id — 결제 단건 조회
  app.get('/v1/payments/:id', { preHandler: requireApiKey }, async (req, reply) => {
    const user = (req as any).apiUser
    const { id } = req.params as { id: string }

    try {
      const payment = await paymentService.getPayment(user.id, id)
      return reply.send(payment)
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({
        error: err.code ?? 'internal_error',
        message: err.message,
      })
    }
  })

  // POST /v1/payments/:id/cancel — 취소/환불
  app.post('/v1/payments/:id/cancel', { preHandler: requireApiKey }, async (req, reply) => {
    const user = (req as any).apiUser
    const { id } = req.params as { id: string }
    const body = cancelSchema.safeParse(req.body)

    if (!body.success) {
      return reply.code(400).send({ error: 'validation_error', message: body.error.errors[0].message })
    }

    try {
      const payment = await paymentService.cancelPayment(
        user.id, id, body.data.amount, body.data.reason
      )
      return reply.send(payment)
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({
        error: err.code ?? 'internal_error',
        message: err.message,
      })
    }
  })

  // ── JWT 기반 (앱/대시보드) ────────────────────────────────────────────────

  // GET /api/payments — 앱용 목록 (JWT)
  app.get('/api/payments', { preHandler: requireJwt }, async (req, reply) => {
    const payload = req.user as any
    const { limit, offset, status } = req.query as any

    const result = await paymentService.listPayments(payload.sub, {
      limit: Number(limit) || 20, offset: Number(offset) || 0, status,
    })
    return reply.send(result)
  })

  // GET /api/payments/:id — 앱용 단건 (JWT)
  app.get('/api/payments/:id', { preHandler: requireJwt }, async (req, reply) => {
    const payload = req.user as any
    const { id } = req.params as { id: string }
    try {
      return reply.send(await paymentService.getPayment(payload.sub, id))
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.code, message: err.message })
    }
  })

  // GET /api/dashboard — 대시보드 통계 (JWT)
  app.get('/api/dashboard', { preHandler: requireJwt }, async (req, reply) => {
    const payload = req.user as any
    const stats = await paymentService.getDashboardStats(payload.sub)
    return reply.send(stats)
  })
}
