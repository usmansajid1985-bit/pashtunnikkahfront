import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { siteOrigin } from "@/lib/site-url";
import { getPlanSettings } from "@/lib/plan-settings";
import { recordCreditChange } from "@/lib/credit-ledger";
import {
  GOLD_MONTHLY_CREDITS,
  TOPUP_AMOUNT_PENCE,
  TOPUP_CREDITS,
} from "@/lib/stripe-constants";

export { GOLD_MONTHLY_CREDITS, TOPUP_AMOUNT_PENCE, TOPUP_CREDITS };

/**
 * Gold renewal math: unused credits roll over up to the plan's rollover cap, then the new
 * monthly allowance is added on top, capped at the plan's max balance. Not a flat reset.
 */
export async function applyGoldRenewal(userId: bigint, currentBalance: number) {
  const settings = await getPlanSettings("gold");
  const rollover = Math.min(Math.max(currentBalance, 0), settings.rolloverCap);
  const newBalance = Math.min(rollover + settings.monthlyCredits, settings.maxBalance);

  await prisma.users.update({
    where: { id: userId },
    data: { requests_remaining: newBalance, updated_at: new Date() },
  });

  if (rollover > 0) {
    await recordCreditChange({
      userId,
      amount: rollover,
      balanceType: "rollover",
      reason: "gold_rollover",
      previousBalance: currentBalance,
      newBalance: rollover,
    });
  }
  await recordCreditChange({
    userId,
    amount: settings.monthlyCredits,
    balanceType: "monthly",
    reason: "monthly_gold_allowance",
    previousBalance: rollover,
    newBalance,
  });

  return newBalance;
}

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

export async function activateGoldFromCheckout(opts: {
  userId: bigint;
  sessionId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  amountPence: number;
}) {
  const now = new Date();
  const existingPay = await prisma.payments.findUnique({
    where: { stripe_session_id: opts.sessionId },
  });

  if (!existingPay) {
    await prisma.payments.create({
      data: {
        id: await nextPaymentId(),
        user_id: opts.userId,
        stripe_session_id: opts.sessionId,
        type: "subscription",
        plan_or_pack: "gold",
        amount_pence: opts.amountPence,
        status: "completed",
        created_at: now,
      },
    });
  } else if (existingPay.status !== "completed") {
    await prisma.payments.update({
      where: { id: existingPay.id },
      data: { status: "completed", amount_pence: opts.amountPence },
    });
  }

  const currentUser = await prisma.users.findUnique({
    where: { id: opts.userId },
    select: { requests_remaining: true },
  });

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

  await applyGoldRenewal(opts.userId, currentUser?.requests_remaining ?? 0);

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
          subscription_started_at: now,
          created_at: now,
        },
      });
    }
  }
}

export async function downgradeFromGold(userId: bigint, reason = "canceled") {
  await prisma.users.update({
    where: { id: userId },
    data: {
      plan: "basic",
      subscription_status: reason,
      updated_at: new Date(),
    },
  });
  await prisma.$executeRaw`UPDATE users SET payment_grace_until = NULL WHERE id = ${userId}`.catch(
    () => undefined
  );
}

export async function activateTopupFromCheckout(opts: {
  userId: bigint;
  sessionId: string;
  amountPence: number;
}) {
  const now = new Date();
  let paymentId: bigint | null = null;
  const existingPay = await prisma.payments.findUnique({
    where: { stripe_session_id: opts.sessionId },
  });

  if (!existingPay) {
    paymentId = await nextPaymentId();
    await prisma.payments.create({
      data: {
        id: paymentId,
        user_id: opts.userId,
        stripe_session_id: opts.sessionId,
        type: "topup",
        plan_or_pack: "5_credits",
        amount_pence: opts.amountPence,
        status: "completed",
        created_at: now,
      },
    });
  } else {
    paymentId = existingPay.id;
    if (existingPay.status === "completed") return;
    await prisma.payments.update({
      where: { id: existingPay.id },
      data: {
        status: "completed",
        amount_pence: opts.amountPence,
        type: "topup",
        plan_or_pack: "5_credits",
      },
    });
  }

  const user = await prisma.users.findUnique({
    where: { id: opts.userId },
    select: { requests_remaining: true },
  });
  const previous = user?.requests_remaining ?? 0;
  const newBalance = previous + TOPUP_CREDITS;

  await prisma.users.update({
    where: { id: opts.userId },
    data: { requests_remaining: newBalance, updated_at: now },
  });

  await recordCreditChange({
    userId: opts.userId,
    amount: TOPUP_CREDITS,
    balanceType: "purchased",
    reason: "topup_purchased",
    previousBalance: previous,
    newBalance,
    relatedPaymentId: paymentId,
    idempotencyKey: `topup_${opts.sessionId}`,
  });
}

export async function markPaymentPastDue(userId: bigint, graceDays = 7) {
  const graceUntil = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
  await prisma.users.update({
    where: { id: userId },
    data: { subscription_status: "past_due", updated_at: new Date() },
  });
  await prisma.$executeRaw`
    UPDATE users SET payment_grace_until = ${graceUntil} WHERE id = ${userId}
  `.catch(() => undefined);
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
    });
    return { ok: true as const, userId: userId.toString(), type: "topup" as const };
  }

  const sub =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customer =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const amount = session.amount_total ?? 1000;

  await activateGoldFromCheckout({
    userId,
    sessionId: session.id,
    customerId: customer,
    subscriptionId: sub,
    amountPence: amount,
  });

  return { ok: true as const, userId: userId.toString(), type: "gold" as const };
}
