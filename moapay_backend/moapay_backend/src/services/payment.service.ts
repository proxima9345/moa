import sql from '../db/client'
import { nanoid } from 'nanoid'
import type { Payment, CreatePaymentBody, PaymentMethod } from '../types'

// ── 수수료 계산 ───────────────────────────────────────────────────────────────
const FEE_RATES: Record<string, Record<PaymentMethod, number>> = {
  starter:    { card: 0.025, kakaopay: 0.015, naverpay: 0.015, tosspay: 0.015, bank: 0.01, phone: 0.02, giftcard: 0.015 },
  business:   { card: 0.015, kakaopay: 0.009, naverpay: 0.009, tosspay: 0.009, bank: 0.007, phone: 0.015, giftcard: 0.01 },
  enterprise: { card: 0.01,  kakaopay: 0.007, naverpay: 0.007, tosspay: 0.007, bank: 0.005, phone: 0.012, giftcard: 0.008 },
}

function calcFee(amount: number, plan: string, method: PaymentMethod): number {
  const rate = FEE_RATES[plan]?.[method] ?? 0.025
  return Math.floor(amount * rate)
}

// ── 결제 ID 생성 ──────────────────────────────────────────────────────────────
function genPaymentId(isLive: boolean): string {
  const prefix = isLive ? 'pay_live' : 'pay_test'
  return `${prefix}_${nanoid(16).toUpperCase()}`
}

// ── PG사 연동 시뮬레이터 (실제 연동 시 교체) ──────────────────────────────────
async function callPgGateway(
  method: PaymentMethod,
  amount: number,
  _metadata: Record<string, unknown>
): Promise<{ success: boolean; pg_tx_id?: string; failure_code?: string; failure_msg?: string }> {
  // 실제 서비스에서는 KG이니시스 / 나이스페이 등 PG SDK 호출
  // 예: await inicis.payment({ mid, amount, orderId, ... })

  // 테스트용: 카드 번호 4242로 시작하면 성공, 4000으로 시작하면 실패
  await new Promise(r => setTimeout(r, 300)) // PG 응답 시뮬레이션

  if (method === 'kakaopay' || method === 'naverpay' || method === 'tosspay') {
    return { success: true, pg_tx_id: `pg_${nanoid(12)}` }
  }

  return {
    success: true,
    pg_tx_id: `pg_${nanoid(12)}`,
  }
}

// ── 결제 생성 ─────────────────────────────────────────────────────────────────
export async function createPayment(
  userId: string,
  plan: string,
  body: CreatePaymentBody,
  isLive = false
): Promise<Payment> {
  const id = genPaymentId(isLive)
  const fee = calcFee(body.amount, plan, body.method)

  // 중복 주문 ID 체크
  if (body.order_id) {
    const [dup] = await sql<Payment[]>`
      SELECT id FROM payments
      WHERE user_id = ${userId} AND order_id = ${body.order_id}
      LIMIT 1
    `
    if (dup) {
      throw Object.assign(new Error('duplicate_order_id'), {
        code: 'duplicate_order_id',
        message: '이미 같은 order_id로 결제가 존재합니다. 고유한 order_id를 사용하세요.',
        statusCode: 409,
      })
    }
  }

  // pending 상태로 먼저 저장
  await sql`
    INSERT INTO payments (
      id, user_id, order_id, amount, currency, method, status,
      customer_name, customer_email, metadata
    ) VALUES (
      ${id}, ${userId}, ${body.order_id ?? null},
      ${body.amount}, ${body.currency ?? 'KRW'}, ${body.method},
      'pending', ${body.customer_name ?? null},
      ${body.customer_email ?? null}, ${JSON.stringify(body.metadata ?? {})}
    )
  `

  // PG 호출
  const pgResult = await callPgGateway(body.method, body.amount, body.metadata ?? {})

  // 결과 업데이트
  if (pgResult.success) {
    const [payment] = await sql<Payment[]>`
      UPDATE payments SET
        status = 'completed',
        pg_tx_id = ${pgResult.pg_tx_id!},
        paid_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    return payment
  } else {
    const [payment] = await sql<Payment[]>`
      UPDATE payments SET
        status = 'failed',
        failure_code = ${pgResult.failure_code!},
        failure_msg  = ${pgResult.failure_msg!}
      WHERE id = ${id}
      RETURNING *
    `
    return payment
  }
}

// ── 결제 조회 ─────────────────────────────────────────────────────────────────
export async function getPayment(userId: string, paymentId: string): Promise<Payment> {
  const [payment] = await sql<Payment[]>`
    SELECT * FROM payments WHERE id = ${paymentId} AND user_id = ${userId}
  `
  if (!payment) throw Object.assign(new Error('not_found'), { statusCode: 404 })
  return payment
}

// ── 결제 목록 ─────────────────────────────────────────────────────────────────
export async function listPayments(
  userId: string,
  opts: { limit?: number; offset?: number; status?: string }
) {
  const limit  = Math.min(opts.limit  ?? 20, 100)
  const offset = opts.offset ?? 0

  const payments = opts.status
    ? await sql<Payment[]>`
        SELECT * FROM payments
        WHERE user_id = ${userId} AND status = ${opts.status}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    : await sql<Payment[]>`
        SELECT * FROM payments
        WHERE user_id = ${userId}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `

  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) FROM payments WHERE user_id = ${userId}
  `
  return { data: payments, total: Number(count), limit, offset }
}

// ── 취소/환불 ─────────────────────────────────────────────────────────────────
export async function cancelPayment(
  userId: string,
  paymentId: string,
  amount?: number,
  reason?: string
): Promise<Payment> {
  const payment = await getPayment(userId, paymentId)

  if (payment.status !== 'completed') {
    throw Object.assign(new Error('invalid_status'), {
      code: 'invalid_status',
      message: `완료된 결제만 취소할 수 있습니다. 현재 상태: ${payment.status}`,
      statusCode: 400,
    })
  }

  const refundAmount = amount ?? payment.amount

  // 부분 취소 검증
  if (refundAmount > payment.amount) {
    throw Object.assign(new Error('amount_exceeded'), {
      code: 'amount_exceeded',
      message: '환불 금액이 결제 금액을 초과합니다.',
      statusCode: 400,
    })
  }

  // refunds 테이블 기록
  await sql`
    INSERT INTO refunds (payment_id, amount, reason, status)
    VALUES (${paymentId}, ${refundAmount}, ${reason ?? null}, 'completed')
  `

  const newStatus = refundAmount === payment.amount ? 'refunded' : 'completed'
  const [updated] = await sql<Payment[]>`
    UPDATE payments SET status = ${newStatus}, cancelled_at = NOW()
    WHERE id = ${paymentId} RETURNING *
  `
  return updated
}

// ── 대시보드 통계 ─────────────────────────────────────────────────────────────
export async function getDashboardStats(userId: string) {
  const [todayStats] = await sql<[{
    revenue: string; count: string; refund: string
  }]>`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS revenue,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS count,
      COALESCE(SUM(CASE WHEN status IN ('refunded','cancelled') THEN amount ELSE 0 END), 0) AS refund
    FROM payments
    WHERE user_id = ${userId}
      AND created_at >= CURRENT_DATE
  `

  const [totalStats] = await sql<[{ total: string; completed: string }]>`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
    FROM payments
    WHERE user_id = ${userId}
      AND created_at >= NOW() - INTERVAL '30 days'
  `

  const weekly = await sql<{ day: string; revenue: string }[]>`
    SELECT
      TO_CHAR(created_at, 'Dy') as day,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as revenue
    FROM payments
    WHERE user_id = ${userId}
      AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at), TO_CHAR(created_at, 'Dy')
    ORDER BY DATE(created_at)
  `

  const recent = await sql<Payment[]>`
    SELECT * FROM payments WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 10
  `

  const total = Number(totalStats.total)
  const completed = Number(totalStats.completed)

  return {
    today_revenue: Number(todayStats.revenue),
    today_count:   Number(todayStats.count),
    today_refund:  Number(todayStats.refund),
    conversion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
    weekly: weekly.map(w => ({ day: w.day, revenue: Number(w.revenue) })),
    recent_payments: recent,
  }
}
