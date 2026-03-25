import postgres from 'postgres'
import { readFileSync } from 'fs'
import { join } from 'path'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
})

export default sql

// ── 마이그레이션 실행 ──────────────────────────────────────────────────────────
export async function runMigrations() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  await sql.unsafe(schema)
  console.log('✅ DB migrations complete')
}

// ── 헬스체크 ──────────────────────────────────────────────────────────────────
export async function checkDbHealth() {
  const [row] = await sql`SELECT NOW() as time`
  return row.time
}
