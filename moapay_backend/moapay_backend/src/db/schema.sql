-- ── MoaPay PostgreSQL Schema ────────────────────────────────────────────────
-- 실행: psql $DATABASE_URL -f src/db/schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  company       VARCHAR(200),
  plan          VARCHAR(20) NOT NULL DEFAULT 'starter', -- starter | business | enterprise
  moa_api_key   VARCHAR(100) UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            VARCHAR(30) PRIMARY KEY,        -- pay_live_XXXX
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id      VARCHAR(100),
  amount        INTEGER NOT NULL,               -- 원 단위
  currency      VARCHAR(3) NOT NULL DEFAULT 'KRW',
  method        VARCHAR(30) NOT NULL,           -- card | kakaopay | naverpay | tosspay | bank | phone
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | completed | failed | cancelled | refunded
  pg_provider   VARCHAR(30),                   -- inicis | nicepay | kcp
  pg_tx_id      VARCHAR(100),                  -- PG사 트랜잭션 ID
  customer_name VARCHAR(100),
  customer_email VARCHAR(255),
  metadata      JSONB DEFAULT '{}',
  failure_code  VARCHAR(50),
  failure_msg   TEXT,
  paid_at       TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id    ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status     ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order_id   ON payments(order_id);

-- ── Refunds ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refunds (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id    VARCHAR(30) NOT NULL REFERENCES payments(id),
  amount        INTEGER NOT NULL,
  reason        TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  pg_refund_id  VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Webhook Events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id),
  event_type    VARCHAR(50) NOT NULL,          -- payment.completed | payment.failed | ...
  payload       JSONB NOT NULL,
  delivered     BOOLEAN DEFAULT FALSE,
  attempts      INTEGER DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Billing Keys (정기결제) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id),
  customer_id   VARCHAR(100) NOT NULL,
  pg_billing_key VARCHAR(200) NOT NULL,
  card_last4    VARCHAR(4),
  card_brand    VARCHAR(30),
  expires_at    DATE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at 자동 갱신 트리거 ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
