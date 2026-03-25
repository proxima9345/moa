export type PaymentMethod =
  | 'card' | 'kakaopay' | 'naverpay' | 'tosspay'
  | 'bank' | 'phone' | 'giftcard'

export type PaymentStatus =
  | 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded'

export type Plan = 'starter' | 'business' | 'enterprise'

export interface User {
  id: string
  email: string
  name: string
  company?: string
  plan: Plan
  moa_api_key?: string
  created_at: Date
}

export interface Payment {
  id: string
  user_id: string
  order_id?: string
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  pg_provider?: string
  pg_tx_id?: string
  customer_name?: string
  customer_email?: string
  metadata: Record<string, unknown>
  failure_code?: string
  failure_msg?: string
  paid_at?: Date
  cancelled_at?: Date
  created_at: Date
  updated_at: Date
}

export interface CreatePaymentBody {
  amount: number
  currency?: string
  method: PaymentMethod
  order_id?: string
  customer_name?: string
  customer_email?: string
  metadata?: Record<string, unknown>
}

export interface DashboardStats {
  today_revenue: number
  today_count: number
  today_refund: number
  conversion_rate: number
  weekly: Array<{ day: string; revenue: number }>
  recent_payments: Payment[]
}

// JWT payload
export interface JwtPayload {
  sub: string   // user id
  email: string
  plan: Plan
  iat: number
  exp: number
}
