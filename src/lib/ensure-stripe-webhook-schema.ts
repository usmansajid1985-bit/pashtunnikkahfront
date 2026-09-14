import { prisma } from "@/lib/prisma";

let ensured = false;

/**
 * Idempotent DDL for Stripe webhook handling (QA billing report — "verify webhook idempotency").
 * `stripe_webhook_events` records every processed Stripe event id so a retried/duplicate delivery
 * (Stripe redelivers on anything but a fast 200) can never re-apply a mutation twice — most
 * importantly `invoice.paid`, which grants a fresh +10 monthly allowance with no other guard.
 * `users.subscription_cancel_at` lets the app show "Cancels on <date>" without calling Stripe.
 */
export async function ensureStripeWebhookSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        event_id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureStripeWebhookSchema", err);
  }
}
