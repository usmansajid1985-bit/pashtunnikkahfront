import { NextResponse } from "next/server";
import { hashPasswordResetToken } from "@/lib/password-reset";
import { consumeVerificationToken } from "@/lib/email-verification";
import { ensureEmailVerificationSchema } from "@/lib/ensure-email-verification-schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") ?? "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing verification token." }, { status: 400 });
  }

  await ensureEmailVerificationSchema();
  const tokenHash = hashPasswordResetToken(token);
  const rows = await prisma.$queryRaw<{ expires_at: Date; used_at: Date | null }[]>`
    SELECT expires_at, used_at FROM email_verification_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `.catch(() => [] as { expires_at: Date; used_at: Date | null }[]);

  const row = rows[0];
  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
    return NextResponse.json(
      { ok: false, error: "This verification link is invalid or has expired." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
    }

    const result = await consumeVerificationToken(token);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Email verified. You can send introductions now." });
  } catch (err) {
    console.error("verify-email error", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
