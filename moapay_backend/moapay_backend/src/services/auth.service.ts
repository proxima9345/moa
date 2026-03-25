import sql from '../db/client'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import type { User } from '../types'

export async function signup(body: {
  email: string; password: string; name: string; company?: string
}): Promise<User> {
  const [existing] = await sql<User[]>`
    SELECT id FROM users WHERE email = ${body.email}
  `
  if (existing) {
    throw Object.assign(new Error('email_taken'), {
      code: 'email_taken',
      message: '이미 사용 중인 이메일입니다.',
      statusCode: 409,
    })
  }

  const hash = await bcrypt.hash(body.password, 12)
  const apiKey = `moa_live_${nanoid(32)}`

  const [user] = await sql<User[]>`
    INSERT INTO users (email, password_hash, name, company, moa_api_key)
    VALUES (${body.email}, ${hash}, ${body.name}, ${body.company ?? null}, ${apiKey})
    RETURNING id, email, name, company, plan, moa_api_key, created_at
  `
  return user
}

export async function login(email: string, password: string): Promise<User> {
  const [user] = await sql<(User & { password_hash: string })[]>`
    SELECT * FROM users WHERE email = ${email}
  `
  if (!user) throw Object.assign(new Error('invalid_credentials'), {
    code: 'invalid_credentials',
    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
    statusCode: 401,
  })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) throw Object.assign(new Error('invalid_credentials'), {
    code: 'invalid_credentials',
    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
    statusCode: 401,
  })

  const { password_hash: _, ...safeUser } = user
  return safeUser as User
}

export async function getUserById(id: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    SELECT id, email, name, company, plan, moa_api_key, created_at
    FROM users WHERE id = ${id}
  `
  return user ?? null
}

export async function getUserByApiKey(apiKey: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    SELECT id, email, name, company, plan, moa_api_key, created_at
    FROM users WHERE moa_api_key = ${apiKey}
  `
  return user ?? null
}
