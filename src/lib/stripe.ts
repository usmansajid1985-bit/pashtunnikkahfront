import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { siteOrigin } from "@/lib/site-url";
import { ensureBillingSchema } from "@/lib/billing-schema";
import {
  applyGoldCycle,
  closeGoldTokens,
  ensureTokenLots,
  extendGoldLotsTo,
  getTokenSettings,
  grantTokens,
} from "@/lib/tokens";
import {
  fmtDay,
  money,
  notifyMemberBilling,
  raiseAdminAlert,
  recordBillingEvent,
  usageBetween,
} from "@/lib/billing-events";
import {
  GOLD_MONTHLY_CREDITS,
  TOPUP_AMOUNT_PENCE,
  TOPUP_CREDITS,
} from "@/lib/stripe-constants";

export { GOLD_MONTHLY_CREDITS, TOPUP_AMOUNT_PENCE, TOPUP_CREDITS };

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, {
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
  });
}

export function appUrl() {
  return siteOrigin().replace(
    /\/$/,
    ""
  );
}

export function goldPriceId() {
  return process.env.STRIPE_GOLD_PRICE_ID || "";
}

export function goldProductId() {
  return process.env.STRIPE_GOLD_PRODUCT_ID || "prod_V1qiv1dlHdfIAF";
}

export function topupPriceId() {
  return process.env.STRIPE_TOPUP_PRICE_ID || "";
}

/**
 * The top-up pack on sale right now: quantity and price from Admin → Billing, with the Stripe
 * Price that admin synced. Falls back to the env/auto-detected price only while the settings
 * still hold the original pack, so a changed price can never be charged at the old amount.
 */
export async function currentTopupPack(): Promise<{ tokens: number; pricePence: number; priceId: string }> {
  const s = await getTokenSettings();
  let priceId = s.topupPriceId || "";
  if (!priceId && s.topupPricePence === TOPUP_AMOUNT_PENCE) priceId = await resolveTopupPriceId();
  return { tokens: s.topupTokens, pricePence: s.topupPricePence, priceId };
}

/**
 * Resolve the real Stripe Price id to charge for a top-up: the configured env var, or (falling
 * back, same as checkout does) whatever active one-time price matches the advertised amount.
 * Shared by the checkout route and the Membership page's "is the top-up actually buyable right
 * now" check, so the button's disabled state can't drift from what checkout would actually do.
 */
export async function resolveTopupPriceId(): Promise<string> {
  const configured = topupPriceId();
  if (configured) return configured;
  try {
    const stripe = getStripe();
    const prices = await stripe.prices.list({ active: true, type: "one_time", limit: 20 });
    return prices.data.find((p) => p.unit_amount === TOPUP_AMOUNT_PENCE)?.id || prices.data[0]?.id || "";
  } catch {
    return "";
  }
}

async function nextPaymentId() {
  const max = await prisma.payments.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

async function nextSubscriptionId() {
  const max = await prisma.subscriptions.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

export async function ensureStripeCustomer(user: {
  id: bigint;
  email: string;
  stripe_customer_id: string | null;
  display_name: string;
}) {
  const stripe = getStripe();
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.display_name || undefined,
    metadata: { userId: user.id.toString() },
  });
  await prisma.users.update({
    where: { id: user.id },
    data: { stripe_customer_id: customer.id, updated_at: new Date() },
  });
  return customer.id;
}

type InvoiceLike = {
  id: string;
  customer?: string | { id: string } | null;
  billing_reason?: string | null;
  amount_paid?: number | null;
  currency?: string | null;
  status?: string | null;
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  lines?: { data?: { period?: { start: number; end: number } | null }[] } | null;
  payment_intent?: string | { id: string } | null;
  payments?: { data?: { payment?: { payment_intent?: string | { id: string } | null } | null }[] } | null;
};

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

export function invoiceSubscriptionId(inv: InvoiceLike): string | null {
  return idOf(inv.subscription) ?? idOf(inv.parent?.subscription_details?.subscription ?? null);
}

function invoicePaymentIntent(inv: InvoiceLike): string | null {
  return idOf(inv.payment_intent) ?? idOf(inv.payments?.data?.[0]?.payment?.payment_intent ?? null);
}

async function nextPaymentIdSafe() {
  return nextPaymentId();
}

/** Find the PN member a Stripe subscription/customer belongs to. */
async function memberForStripe(subId: string | null, customerId: string | null, metaUserId?: string | null) {
  if (subId) {
    const u = await prisma.users.findFirst({ where: { stripe_subscription_id: subId } });
    if (u) return u;
  }
  if (metaUserId && /^\d+$/.test(metaUserId)) {
    const u = await prisma.users.findUnique({ where: { id: BigInt(metaUserId) } });
    if (u) return u;
  }
  if (customerId) {
    const u = await prisma.users.findFirst({ where: { stripe_customer_id: customerId } });
    if (u) return u;
  }
  return null;
}

/**
 * A paid Gold invoice — first payment or renewal. Called by invoice.paid AND by checkout
 * completion (which fetches the subscription's first invoice), so whichever arrives first grants
 * and the other is a no-op: payment rows key on the invoice, tokens on `gold_<invoice id>`.
 */
export async function handleGoldInvoicePaid(inv: InvoiceLike, metaUserId?: string | null) {
  await ensureBillingSchema();
  const subId = invoiceSubscriptionId(inv);
  if (!subId) return { ok: false as const, reason: "not a subscription invoice" };
  const customerId = idOf(inv.customer ?? null);
  let member = await memberForStripe(subId, customerId, metaUserId);
  if (!member) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subId);
      member = await memberForStripe(subId, customerId, sub.metadata?.userId ?? null);
    } catch {
      /* fall through to the alert */
    }
  }
  if (!member) {
    await raiseAdminAlert({
      kind: "paid_without_credit",
      severity: "critical",
      message: `Invoice ${inv.id} (${money(inv.amount_paid, inv.currency || "gbp")}) was paid but no PN member matches subscription ${subId}.`,
      data: { invoiceId: inv.id, subscriptionId: subId, customerId },
      dedupeKey: `nomember_${inv.id}`,
    });
    return { ok: false as const, reason: "no member" };
  }

  const period = inv.lines?.data?.[0]?.period;
  const periodStart = period ? new Date(period.start * 1000) : new Date();
  const periodEnd = period ? new Date(period.end * 1000) : new Date(Date.now() + 30 * 86400000);
  const first = inv.billing_reason === "subscription_create";
  const currency = (inv.currency || "gbp").toLowerCase();
  const pi = invoicePaymentIntent(inv);

  // Payment row: reuse the pending one checkout created for a first payment, else one per invoice.
  const existing = await prisma.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM payments WHERE stripe_invoice_id = ${inv.id} LIMIT 1
  `;
  let paymentId = existing[0]?.id ?? null;
  if (!paymentId && first) {
    const pending = await prisma.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM payments
      WHERE user_id = ${member.id} AND type = 'subscription' AND stripe_invoice_id IS NULL
        AND created_at > NOW() - INTERVAL '2 days'
      ORDER BY created_at DESC LIMIT 1
    `;
    paymentId = pending[0]?.id ?? null;
  }
  if (!paymentId) {
    paymentId = await nextPaymentIdSafe();
    await prisma.payments.create({
      data: {
        id: paymentId,
        user_id: member.id,
        stripe_session_id: `inv_${inv.id}`,
        type: "subscription",
        plan_or_pack: first ? "gold" : "gold_renewal",
        amount_pence: inv.amount_paid ?? 0,
        currency,
        status: "completed",
        created_at: new Date(),
      },
    });
  }
  await prisma.$executeRaw`
    UPDATE payments SET status = 'completed', amount_pence = ${inv.amount_paid ?? 0}, currency = ${currency},
      stripe_invoice_id = ${inv.id}, stripe_payment_intent_id = COALESCE(${pi}, stripe_payment_intent_id),
      stripe_subscription_id = ${subId}, period_start = ${periodStart}, period_end = ${periodEnd}
    WHERE id = ${paymentId}
  `;

  await ensureTokenLots(member.id);
  await prisma.users.update({
    where: { id: member.id },
    data: {
      plan: "gold",
      subscription_status: "active",
      stripe_subscription_id: subId,
      stripe_customer_id: customerId || undefined,
      updated_at: new Date(),
    },
  });
  await prisma.$executeRaw`UPDATE users SET payment_grace_until = NULL WHERE id = ${member.id}`;

  const grant = await applyGoldCycle({ userId: member.id, invoiceId: inv.id, periodStart, periodEnd, paymentId });

  const isNew = await recordBillingEvent({
    userId: member.id,
    kind: first ? "gold_started" : "renewal",
    amountPence: inv.amount_paid ?? 0,
    currency,
    stripeRef: inv.id,
    data: { subscriptionId: subId, paymentIntent: pi, periodStart, periodEnd, gold: grant.gold, rollover: grant.rollover },
    dedupeKey: `invoice_${inv.id}`,
  });
  if (isNew) {
    const tokensLine = grant.rollover > 0
      ? `${grant.gold} Match Tokens have been added, plus ${grant.rollover} rolled over from last month.`
      : `${grant.gold} Match Tokens have been added to your account.`;
    await notifyMemberBilling(member.id, first
      ? {
          type: "payment_success",
          title: "Welcome to Gold",
          body: `Payment of ${money(inv.amount_paid, currency)} received. ${tokensLine}`,
          lines: [
            "Assalamu Alaikum,",
            `Thank you — your payment of ${money(inv.amount_paid, currency)} was successful and your Gold membership is now active.`,
            tokensLine,
            `Your membership renews on ${fmtDay(periodEnd)}.`,
          ],
        }
      : {
          type: "renewal",
          title: "Your Gold membership has renewed",
          body: `${money(inv.amount_paid, currency)} paid. ${tokensLine}`,
          lines: [
            "Assalamu Alaikum,",
            `Your Gold membership renewed successfully (${money(inv.amount_paid, currency)}).`,
            tokensLine,
            `Next renewal: ${fmtDay(periodEnd)}.`,
          ],
        });
  }
  return { ok: true as const, userId: member.id, granted: grant.granted };
}

export async function activateGoldFromCheckout(opts: {
  userId: bigint;
  sessionId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  amountPence: number;
  currency?: string | null;
}) {
  await ensureBillingSchema();
  const now = new Date();
  const currency = (opts.currency || "gbp").toLowerCase();
  const before = await prisma.users.findUnique({
    where: { id: opts.userId },
    select: { plan: true, subscription_status: true, stripe_subscription_id: true },
  });
  if (
    before?.stripe_subscription_id &&
    opts.subscriptionId &&
    before.stripe_subscription_id !== opts.subscriptionId &&
    (before.plan || "").toLowerCase() === "gold" &&
    ["active", "trialing", "past_due"].includes(before.subscription_status || "")
  ) {
    await raiseAdminAlert({
      kind: "duplicate_subscription",
      severity: "critical",
      userId: opts.userId,
      message: `Member started a second Gold subscription (${opts.subscriptionId}) while ${before.stripe_subscription_id} was still ${before.subscription_status}. One should be cancelled and refunded.`,
      data: { previous: before.stripe_subscription_id, next: opts.subscriptionId },
      dedupeKey: `dupsub_${opts.subscriptionId}`,
    });
  }

  await ensureTokenLots(opts.userId);
  await prisma.users.update({
    where: { id: opts.userId },
    data: {
      plan: "gold",
      subscription_status: "active",
      stripe_subscription_id: opts.subscriptionId || undefined,
      stripe_customer_id: opts.customerId || undefined,
      updated_at: now,
    },
  });
  // A fresh checkout means any previously-scheduled cancellation no longer applies.
  await prisma.$executeRaw`UPDATE users SET subscription_cancel_at = NULL, payment_grace_until = NULL WHERE id = ${opts.userId}`;

  if (opts.subscriptionId) {
    const existingSub = await prisma.subscriptions.findFirst({
      where: { stripe_subscription_id: opts.subscriptionId },
    });
    if (!existingSub) {
      await prisma.subscriptions.create({
        data: {
          id: await nextSubscriptionId(),
          user_id: opts.userId,
          stripe_subscription_id: opts.subscriptionId,
          stripe_payment_intent_id: "",
          plan: "gold",
          amount_pence: opts.amountPence,
          currency,
          subscription_started_at: now,
          created_at: now,
        },
      });
    }
    // Tokens come from the subscription's first invoice — the same path invoice.paid takes.
    const sub = await getStripe().subscriptions.retrieve(opts.subscriptionId, { expand: ["latest_invoice"] });
    const inv = sub.latest_invoice as unknown as InvoiceLike | string | null;
    if (inv && typeof inv !== "string" && inv.status === "paid") {
      await handleGoldInvoicePaid(inv, opts.userId.toString());
    }
  }
}

/**
 * Gold has ended (cancelled at period end, or still unpaid after grace): back to Basic. Purchased
 * and admin-granted tokens, chats and free entitlements stay; Gold and rollover tokens close.
 */
export async function downgradeFromGold(userId: bigint, reason = "canceled", endKey?: string) {
  await ensureBillingSchema();
  const before = await prisma.users.findUnique({
    where: { id: userId },
    select: { plan: true, stripe_subscription_id: true },
  });
  await prisma.users.update({
    where: { id: userId },
    data: { plan: "basic", subscription_status: reason, updated_at: new Date() },
  });
  await prisma.$executeRaw`
    UPDATE users SET payment_grace_until = NULL, subscription_cancel_at = NULL WHERE id = ${userId}
  `;
  const key = endKey || before?.stripe_subscription_id || new Date().toISOString().slice(0, 10);
  await closeGoldTokens(userId, key);
  const isNew = await recordBillingEvent({
    userId,
    kind: "gold_ended",
    reason,
    stripeRef: before?.stripe_subscription_id ?? null,
    dedupeKey: `goldend_${key}`,
  });
  if (isNew && (before?.plan || "").toLowerCase() === "gold") {
    await notifyMemberBilling(userId, {
      type: "gold_expired",
      title: "Your Gold membership has ended",
      body: "You're now on Basic. Your chats and any purchased Match Tokens are still here.",
      lines: [
        "Assalamu Alaikum,",
        reason === "unpaid" || reason === "past_due"
          ? "We couldn't take payment for your Gold renewal, so your membership has moved to Basic."
          : "Your Gold membership has ended and your account has moved to Basic.",
        "Your conversations, saved profiles and any Match Tokens you bought are still in your account, and you'll keep receiving the free monthly Match Tokens.",
        "You can rejoin Gold any time from Settings → Membership.",
      ],
      ctaLabel: "Rejoin Gold",
    });
  }
}

export async function activateTopupFromCheckout(opts: {
  userId: bigint;
  sessionId: string;
  amountPence: number;
  currency?: string | null;
  tokens?: number | null;
  paymentIntentId?: string | null;
}) {
  await ensureBillingSchema();
  const now = new Date();
  const currency = (opts.currency || "gbp").toLowerCase();
  const settings = await getTokenSettings();
  const tokens = opts.tokens && opts.tokens > 0 ? opts.tokens : settings.topupTokens;
  let paymentId: bigint;
  const existingPay = await prisma.payments.findUnique({ where: { stripe_session_id: opts.sessionId } });
  if (!existingPay) {
    paymentId = await nextPaymentId();
    await prisma.payments.create({
      data: {
        id: paymentId,
        user_id: opts.userId,
        stripe_session_id: opts.sessionId,
        type: "topup",
        plan_or_pack: `${tokens}_credits`,
        amount_pence: opts.amountPence,
        currency,
        status: "completed",
        created_at: now,
      },
    });
  } else {
    paymentId = existingPay.id;
    await prisma.payments.update({
      where: { id: existingPay.id },
      data: { status: "completed", amount_pence: opts.amountPence, currency, type: "topup", plan_or_pack: `${tokens}_credits` },
    });
  }
  if (opts.paymentIntentId) {
    await prisma.$executeRaw`UPDATE payments SET stripe_payment_intent_id = ${opts.paymentIntentId} WHERE id = ${paymentId}`;
  }

  const grant = await grantTokens({
    userId: opts.userId,
    source: "purchased",
    amount: tokens,
    expiresAt: null,
    idempotencyKey: `topup_${opts.sessionId}`,
    reason: "topup_purchased",
    paymentId,
    stripeRef: opts.sessionId,
  });
  const isNew = await recordBillingEvent({
    userId: opts.userId,
    kind: "topup_purchased",
    amountPence: opts.amountPence,
    currency,
    stripeRef: opts.sessionId,
    data: { tokens, paymentIntent: opts.paymentIntentId ?? null },
    dedupeKey: `topup_${opts.sessionId}`,
  });
  if (isNew) {
    await notifyMemberBilling(opts.userId, {
      type: "payment_success",
      title: `${tokens} Match Tokens added`,
      body: `Payment of ${money(opts.amountPence, currency)} received. Your balance is now ${grant.balance}.`,
      lines: [
        "Assalamu Alaikum,",
        `Thank you — your payment of ${money(opts.amountPence, currency)} was successful.`,
        `${tokens} Match Tokens have been added to your account. Purchased tokens never expire.`,
        `Your balance is now ${grant.balance} Match Tokens.`,
      ],
      ctaLabel: "Browse members",
      url: "/browse",
    });
  }
}

/** Renewal failed: Gold carries on through the grace period, then ends if still unpaid. */
export async function markPaymentPastDue(userId: bigint, invoice?: InvoiceLike | null) {
  await ensureBillingSchema();
  const settings = await getTokenSettings();
  const existing = await prisma.$queryRaw<{ payment_grace_until: Date | null }[]>`
    SELECT payment_grace_until FROM users WHERE id = ${userId}
  `;
  const graceUntil =
    existing[0]?.payment_grace_until && existing[0].payment_grace_until.getTime() > Date.now()
      ? existing[0].payment_grace_until
      : new Date(Date.now() + settings.graceDays * 86400000);
  await prisma.users.update({
    where: { id: userId },
    data: { subscription_status: "past_due", updated_at: new Date() },
  });
  await prisma.$executeRaw`UPDATE users SET payment_grace_until = ${graceUntil} WHERE id = ${userId}`;
  await extendGoldLotsTo(userId, graceUntil);
  const isNew = await recordBillingEvent({
    userId,
    kind: "payment_failed",
    amountPence: invoice ? (invoice as { amount_due?: number }).amount_due ?? null : null,
    currency: invoice?.currency ?? "gbp",
    stripeRef: invoice?.id ?? null,
    data: { graceUntil },
    dedupeKey: invoice ? `failed_${invoice.id}` : `failed_${userId}_${graceUntil.toISOString().slice(0, 10)}`,
  });
  if (isNew) {
    await notifyMemberBilling(userId, {
      type: "payment_failed",
      title: "We couldn't renew your Gold membership",
      body: `Please update your payment details before ${fmtDay(graceUntil)} to keep Gold.`,
      lines: [
        "Assalamu Alaikum,",
        "Your Gold renewal payment didn't go through.",
        `You'll keep Gold and your Match Tokens until ${fmtDay(graceUntil)}. Please update your card in Settings → Membership before then — if the payment still fails, your account will move to Basic.`,
      ],
      ctaLabel: "Update payment details",
    });
  }
}

/** Cancellation scheduled / reverted (customer.subscription.updated). */
export async function recordCancellationChange(
  userId: bigint,
  sub: { id: string; cancel_at: number | null; cancel_at_period_end?: boolean; cancellation_details?: { reason?: string | null; feedback?: string | null; comment?: string | null } | null },
  previousCancelAt: Date | null
) {
  const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : null;
  if (cancelAt && !previousCancelAt) {
    const details = sub.cancellation_details;
    const reason = [details?.feedback, details?.comment, details?.reason].filter(Boolean).join(" — ") || null;
    const isNew = await recordBillingEvent({
      userId,
      kind: "cancellation_scheduled",
      stripeRef: sub.id,
      reason,
      data: { paidThrough: cancelAt, ...details },
      dedupeKey: `cancel_${sub.id}_${sub.cancel_at}`,
    });
    if (isNew) {
      await notifyMemberBilling(userId, {
        type: "cancellation",
        title: "Your Gold cancellation is confirmed",
        body: `Gold stays active until ${fmtDay(cancelAt)}.`,
        lines: [
          "Assalamu Alaikum,",
          `We've cancelled your Gold renewal. You've paid through ${fmtDay(cancelAt)} and keep every Gold feature and your Match Tokens until then.`,
          "After that your account moves to Basic — your chats and any purchased tokens stay. Changed your mind? You can resume Gold any time before that date.",
        ],
      });
    }
  } else if (!cancelAt && previousCancelAt) {
    await recordBillingEvent({
      userId,
      kind: "cancellation_reverted",
      stripeRef: sub.id,
      dedupeKey: `uncancel_${sub.id}_${previousCancelAt.getTime()}`,
    });
  }
}

type ChargeLike = {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  payment_intent?: string | { id: string } | null;
  customer?: string | { id: string } | null;
  refunds?: { data?: { id: string; reason?: string | null; status?: string | null; amount: number }[] } | null;
};

async function paymentForCharge(charge: ChargeLike) {
  const pi = idOf(charge.payment_intent ?? null);
  if (pi) {
    const rows = await prisma.$queryRaw<{ id: bigint; user_id: bigint; created_at: Date }[]>`
      SELECT id, user_id, created_at FROM payments WHERE stripe_payment_intent_id = ${pi} LIMIT 1
    `;
    if (rows[0]) return rows[0];
    try {
      const stripe = getStripe();
      const ips = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: pi }, limit: 1 });
      const invId = idOf((ips.data[0] as unknown as { invoice?: string | { id: string } })?.invoice ?? null);
      if (invId) {
        const byInv = await prisma.$queryRaw<{ id: bigint; user_id: bigint; created_at: Date }[]>`
          SELECT id, user_id, created_at FROM payments WHERE stripe_invoice_id = ${invId} LIMIT 1
        `;
        if (byInv[0]) {
          await prisma.$executeRaw`UPDATE payments SET stripe_payment_intent_id = ${pi} WHERE id = ${byInv[0].id}`;
          return byInv[0];
        }
      }
      const sessions = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 });
      const sid = sessions.data[0]?.id;
      if (sid) {
        const bySession = await prisma.payments.findUnique({ where: { stripe_session_id: sid } });
        if (bySession) {
          await prisma.$executeRaw`UPDATE payments SET stripe_payment_intent_id = ${pi} WHERE id = ${bySession.id}`;
          return { id: bySession.id, user_id: bySession.user_id, created_at: bySession.created_at };
        }
      }
    } catch (err) {
      console.error("[stripe] payment lookup for charge failed", err);
    }
  }
  return null;
}

/** charge.refunded: record the refund (and what the member used between paying and the refund). */
export async function handleChargeRefunded(charge: ChargeLike) {
  await ensureBillingSchema();
  const pay = await paymentForCharge(charge);
  const customer = idOf(charge.customer ?? null);
  const member = pay ? { id: pay.user_id } : customer ? await prisma.users.findFirst({ where: { stripe_customer_id: customer }, select: { id: true } }) : null;
  const latest = charge.refunds?.data?.[0];
  if (pay) {
    await prisma.$executeRaw`
      UPDATE payments SET refunded_pence = ${charge.amount_refunded}, refund_reason = ${latest?.reason ?? null},
        status = ${charge.amount_refunded >= charge.amount ? "refunded" : "partially_refunded"}
      WHERE id = ${pay.id}
    `;
  }
  if (!member) {
    await raiseAdminAlert({
      kind: "refund_error",
      message: `Refund on charge ${charge.id} (${money(charge.amount_refunded, charge.currency)}) couldn't be matched to a PN member or payment.`,
      data: { chargeId: charge.id },
      dedupeKey: `refund_nomatch_${charge.id}`,
    });
    return;
  }
  const usage = pay ? await usageBetween(member.id, pay.created_at, new Date()) : null;
  await recordBillingEvent({
    userId: member.id,
    kind: "refund",
    amountPence: charge.amount_refunded,
    currency: charge.currency,
    stripeRef: latest?.id ?? charge.id,
    reason: latest?.reason ?? null,
    data: { chargeId: charge.id, paymentId: pay?.id ?? null, usageSincePayment: usage },
    dedupeKey: `refund_${charge.id}_${charge.amount_refunded}`,
  });
}

/** Disputes are always an admin alert. */
export async function handleDispute(
  dispute: { id: string; amount: number; currency: string; reason?: string | null; status: string; charge?: string | { id: string } | null; payment_intent?: string | { id: string } | null },
  phase: "opened" | "closed"
) {
  await ensureBillingSchema();
  const pay = await paymentForCharge({
    id: idOf(dispute.charge ?? null) ?? dispute.id,
    amount: dispute.amount,
    amount_refunded: 0,
    currency: dispute.currency,
    payment_intent: dispute.payment_intent ?? null,
  });
  if (pay && phase === "opened") await prisma.$executeRaw`UPDATE payments SET disputed_at = NOW() WHERE id = ${pay.id}`;
  await recordBillingEvent({
    userId: pay?.user_id ?? null,
    kind: phase === "opened" ? "dispute_opened" : "dispute_closed",
    amountPence: dispute.amount,
    currency: dispute.currency,
    stripeRef: dispute.id,
    reason: phase === "opened" ? dispute.reason ?? null : dispute.status,
    dedupeKey: `dispute_${dispute.id}_${phase}`,
  });
  if (phase === "opened") {
    await raiseAdminAlert({
      kind: "dispute",
      severity: "critical",
      userId: pay?.user_id ?? null,
      message: `Card dispute opened (${money(dispute.amount, dispute.currency)}, reason: ${dispute.reason || "unknown"}). Respond in Stripe before the deadline.`,
      data: { disputeId: dispute.id },
      dedupeKey: `dispute_${dispute.id}`,
    });
  }
}

export async function syncCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "line_items"],
  });
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { ok: false as const, error: "Checkout not complete" };
  }

  const userIdRaw = session.metadata?.userId || session.client_reference_id;
  if (!userIdRaw) return { ok: false as const, error: "Missing user on session" };
  const userId = BigInt(userIdRaw);

  if (session.metadata?.checkoutType === "topup") {
    await activateTopupFromCheckout({
      userId,
      sessionId: session.id,
      amountPence: session.amount_total ?? TOPUP_AMOUNT_PENCE,
      currency: session.currency,
      tokens: Number(session.metadata?.tokens) || null,
      paymentIntentId: idOf(session.payment_intent as string | { id: string } | null),
    });
    return { ok: true as const, userId: userId.toString(), type: "topup" as const };
  }

  await activateGoldFromCheckout({
    userId,
    sessionId: session.id,
    customerId: idOf(session.customer as string | { id: string } | null),
    subscriptionId: idOf(session.subscription as string | { id: string } | null),
    amountPence: session.amount_total ?? 999,
    currency: session.currency,
  });

  return { ok: true as const, userId: userId.toString(), type: "gold" as const };
}
