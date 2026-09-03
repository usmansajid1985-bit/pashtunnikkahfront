import { prisma } from "@/lib/prisma";

export type CreditBalanceType = "monthly" | "rollover" | "purchased" | "promotional" | "admin";

export type CreditReason =
  | "monthly_free_allowance"
  | "monthly_gold_allowance"
  | "gold_rollover"
  | "request_sent"
  | "topup_purchased"
  | "admin_adjustment"
  | "fraud_refund"
  | "technical_restoration"
  | "subscription_cancellation"
  | "promotional_credit"
  | "referral_reward";

async function nextLedgerId() {
  const max = await prisma.credit_ledger.aggregate({ _max: { id: true } });
  return (max._max.id ?? BigInt(0)) + BigInt(1);
}

/** Append-only audit trail entry for a credit balance change. Does not itself mutate the balance. */
export async function recordCreditChange(opts: {
  userId: bigint;
  amount: number;
  balanceType: CreditBalanceType;
  reason: CreditReason;
  previousBalance: number;
  newBalance: number;
  relatedRequestId?: bigint | null;
  relatedPaymentId?: bigint | null;
  adminId?: bigint | null;
  idempotencyKey?: string | null;
}) {
  return prisma.credit_ledger.create({
    data: {
      id: await nextLedgerId(),
      user_id: opts.userId,
      amount: opts.amount,
      balance_type: opts.balanceType,
      reason: opts.reason,
      related_request_id: opts.relatedRequestId ?? null,
      related_payment_id: opts.relatedPaymentId ?? null,
      admin_id: opts.adminId ?? null,
      previous_balance: opts.previousBalance,
      new_balance: opts.newBalance,
      idempotency_key: opts.idempotencyKey ?? null,
      created_at: new Date(),
    },
  });
}
