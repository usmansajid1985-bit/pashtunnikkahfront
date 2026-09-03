-- CreateTable
CREATE TABLE "subscriptions" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "stripe_subscription_id" VARCHAR(255) NOT NULL DEFAULT '',
    "stripe_payment_intent_id" VARCHAR(255) NOT NULL DEFAULT '',
    "plan" VARCHAR(50) NOT NULL DEFAULT 'gold',
    "amount_pence" INTEGER NOT NULL DEFAULT 0,
    "subscription_started_at" TIMESTAMPTZ(6) NOT NULL,
    "refund_eligible" BOOLEAN NOT NULL DEFAULT true,
    "refund_eligibility_lost_at" TIMESTAMPTZ(6),
    "refund_ineligible_reason" VARCHAR(255),
    "refund_requested_at" TIMESTAMPTZ(6),
    "refund_status" VARCHAR(30),
    "refund_processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_events" (
    "id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGINT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL DEFAULT '',
    "display_name" VARCHAR(255) NOT NULL DEFAULT '',
    "role" VARCHAR(32) NOT NULL DEFAULT 'user',
    "account_status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "sms_verified" BOOLEAN NOT NULL DEFAULT false,
    "cultural_verified" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "founding_member" BOOLEAN NOT NULL DEFAULT false,
    "legacy_member" BOOLEAN NOT NULL DEFAULT false,
    "trust_level" INTEGER NOT NULL DEFAULT 0,
    "referral_code" VARCHAR(64),
    "stripe_customer_id" VARCHAR(255),
    "plan" VARCHAR(50),
    "subscription_status" VARCHAR(50),
    "stripe_subscription_id" VARCHAR(255),
    "requests_remaining" INTEGER NOT NULL DEFAULT 0,
    "nudges_remaining" INTEGER NOT NULL DEFAULT 0,
    "free_starter_credits" INTEGER NOT NULL DEFAULT 0,
    "free_starter_awarded" BOOLEAN NOT NULL DEFAULT false,
    "female_mode" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "deletion_requested_at" TIMESTAMPTZ(6),
    "deletion_reason" TEXT,
    "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_security" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "totp_secret" VARCHAR(64),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_type" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(64) NOT NULL,
    "related_request_id" BIGINT,
    "related_payment_id" BIGINT,
    "admin_id" BIGINT,
    "previous_balance" INTEGER NOT NULL,
    "new_balance" INTEGER NOT NULL,
    "idempotency_key" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_settings" (
    "id" BIGSERIAL NOT NULL,
    "plan" VARCHAR(32) NOT NULL,
    "monthly_credits" INTEGER NOT NULL,
    "rollover_cap" INTEGER NOT NULL DEFAULT 0,
    "max_balance" INTEGER NOT NULL,
    "pending_request_limit" INTEGER NOT NULL,
    "request_expiry_days" INTEGER NOT NULL DEFAULT 7,
    "saved_profile_limit" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_settings_pkey" PRIMARY KEY ("id")
);