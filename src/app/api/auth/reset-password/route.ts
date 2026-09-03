import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { ensurePasswordResetSchema } from "@/lib/ensure-password-reset-schema";
import { hashPasswordResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") ?? "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing reset token." }, { status: 400 });
  }

  await ensurePasswordResetSchema();
  const tokenHash = hashPasswordResetToken(token);
  const rows = await prisma.$queryRaw<{ id: bigint; expires_at: Date; used_at: Date | null }[]>`
    SELECT id, expires_at, used_at FROM password_resets
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `.catch(() => [] as { id: bigint; expires_at: Date; used_at: Date | null }[]);

  const row = rows[0];
  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
    return NextResponse.json(
      { ok: false, error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    const confirm = String(body.confirm ?? "");

    if (!token) {
      return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password !== confirm) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    await ensurePasswordResetSchema();
    const tokenHash = hashPasswordResetToken(token);
    const rows = await prisma.$queryRaw<
      { id: bigint; user_id: bigint; expires_at: Date; used_at: Date | null }[]
    >`
      SELECT id, user_id, expires_at, used_at FROM password_resets
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `.catch(
      () => [] as { id: bigint; user_id: bigint; expires_at: Date; used_at: Date | null }[]
    );

    const row = rows[0];
    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 }
      );
    }

    const password_hash = await hashPassword(password);
    await prisma.users.update({
      where: { id: row.user_id },
      data: { password_hash, updated_at: new Date() },
    });
    await prisma.$executeRaw`
      UPDATE password_resets SET used_at = NOW() WHERE id = ${row.id}
    `;
    await prisma.$executeRaw`
      UPDATE password_resets
      SET used_at = NOW()
      WHERE user_id = ${row.user_id} AND used_at IS NULL AND id <> ${row.id}
    `;

    return NextResponse.json({ ok: true, redirectTo: "/login" });
  } catch (err) {
    console.error("reset-password error", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
