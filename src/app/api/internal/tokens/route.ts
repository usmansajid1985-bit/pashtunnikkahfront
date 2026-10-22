import { NextResponse } from "next/server";
import { readSignedInternal } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { ensureBillingSchema } from "@/lib/billing-schema";
import { grantTokens, removeTokens } from "@/lib/tokens";
import { notifyMemberBilling } from "@/lib/billing-events";

export const dynamic = "force-dynamic";

type Op = {
  op: "grant" | "remove";
  amount: number;
  reason: string;
  adminId: string;
  key: string;
  expiresAt?: string | null;
};

/**
 * Admin → Billing: grant or remove Match Tokens. The whole operation (incl. its random `key`) is
 * inside the signed `status` field, and the key is claimed in the ledger first, so a replayed or
 * double-submitted request is applied once. The reason is mandatory and lands in the audit log.
 */
export async function POST(req: Request) {
  const signed = await readSignedInternal(req);
  if (!signed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let op: Op;
  try {
    op = JSON.parse(signed.status) as Op;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const amount = Math.floor(Number(op.amount));
  const reason = String(op.reason || "").trim().slice(0, 500);
  if (!["grant", "remove"].includes(op.op) || !(amount >= 1 && amount <= 100)) {
    return NextResponse.json({ error: "Amount must be between 1 and 100." }, { status: 400 });
  }
  if (reason.length < 5) return NextResponse.json({ error: "A reason is required." }, { status: 400 });
  if (!/^[\w-]{8,64}$/.test(op.key || "")) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  await ensureBillingSchema();
  const userId = BigInt(signed.userId);
  const adminId = /^\d+$/.test(op.adminId || "") ? BigInt(op.adminId) : null;
  const claimed = await prisma.$executeRaw`
    INSERT INTO credit_ledger (user_id, amount, balance_type, reason, admin_id, previous_balance, new_balance, idempotency_key, created_at, note)
    SELECT ${userId}, 0, 'admin', 'admin_operation', ${adminId}, COALESCE(requests_remaining, 0), COALESCE(requests_remaining, 0),
           ${`adminop_${op.key}`}, NOW(), ${`${op.op} ${amount}: ${reason}`}
    FROM users WHERE id = ${userId}
    ON CONFLICT (idempotency_key) DO NOTHING
  `;
  if (claimed === 0) return NextResponse.json({ ok: true, duplicate: true });

  if (op.op === "grant") {
    const expiresAt = op.expiresAt ? new Date(op.expiresAt) : null;
    const res = await grantTokens({
      userId,
      source: "admin",
      amount,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      idempotencyKey: `admin_${op.key}`,
      reason: "admin_grant",
      adminId,
      note: reason,
    });
    await notifyMemberBilling(userId, {
      type: "tokens_added",
      title: `${amount} Match Token${amount === 1 ? "" : "s"} added to your account`,
      body: "Added by the Pashtun Nikah team.",
      lines: ["Assalamu Alaikum,", `The Pashtun Nikah team has added ${amount} Match Token${amount === 1 ? "" : "s"} to your account.`],
      ctaLabel: "Browse members",
      url: "/browse",
    });
    return NextResponse.json({ ok: true, balance: res.balance });
  }
  const res = await removeTokens(userId, amount, adminId, reason);
  return NextResponse.json({ ok: true, removed: res.removed, balance: res.balance });
}
