import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as authService from '../services/auth.service'

const signupSchema = z.object({
  email:    z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  name:     z.string().min(1),
  company:  z.string().optional(),
})

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/signup
  app.post('/auth/signup', async (req, reply) => {
    const body = signupSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({
        error: 'validation_error',
        message: body.error.errors[0].message,
        details: body.error.errors,
      })
    }

    try {
      const user = await authService.signup(body.data)
      const token = app.jwt.sign({
        sub: user.id, email: user.email, plan: user.plan,
      }, { expiresIn: '7d' })

      return reply.code(201).send({ user, token })
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({
        error: err.code ?? 'internal_error',
        message: err.message,
      })
    }
  })

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'validation_error', message: '입력값을 확인하세요.' })
    }

    try {
      const user = await authService.login(body.data.email, body.data.password)
      const token = app.jwt.sign({
        sub: user.id, email: user.email, plan: user.plan,
      }, { expiresIn: '7d' })

      return reply.send({ user, token })
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({
        error: err.code ?? 'internal_error',
        message: err.message,
      })
    }
  })

  // GET /auth/me  (JWT 필요)
  app.get('/auth/me', {
    preHandler: async (req, reply) => {
      try { await req.jwtVerify() }
      catch { reply.code(401).send({ error: 'unauthorized' }) }
    }
  }, async (req, reply) => {
    const payload = req.user as any
    const user = await authService.getUserById(payload.sub)
    if (!user) return reply.code(404).send({ error: 'not_found' })
    return reply.send({ user })
  })
}
