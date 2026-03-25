import type { FastifyInstance } from 'fastify'
import { verifyWebhookSignature } from '../middleware/auth.middleware'
import sql from '../db/client'

export async function webhookRoutes(app: FastifyInstance) {

  // POST /webhooks — PG사 → MoaPay 서버 수신
  app.post('/webhooks', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const signature  = req.headers['moa-signature'] as string ?? ''
    const rawBody    = (req as any).rawBody as string ?? JSON.stringify(req.body)
    const secret     = process.env.MOA_WEBHOOK_SECRET ?? ''

    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      return reply.code(400).send({ error: 'invalid_signature' })
    }

    const event = req.body as { type: string; data: { object: any } }

    // 이벤트 저장
    await sql`
      INSERT INTO webhook_events (event_type, payload, delivered)
      VALUES (${event.type}, ${JSON.stringify(event)}, true)
    `

    // 이벤트 처리
    switch (event.type) {
      case 'payment.completed':
        await sql`
          UPDATE payments SET status = 'completed', paid_at = NOW()
          WHERE id = ${event.data.object.id}
        `
        break
      case 'payment.failed':
        await sql`
          UPDATE payments SET
            status = 'failed',
            failure_code = ${event.data.object.failure_code},
            failure_msg  = ${event.data.object.failure_msg}
          WHERE id = ${event.data.object.id}
        `
        break
    }

    return reply.send({ received: true })
  })
}
