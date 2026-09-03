import { NextResponse } from "next/server";
import { findUserForLogin } from "@/lib/auth";
import { ensurePasswordResetSchema } from "@/lib/ensure-password-reset-schema";
import { passwordResetEmail, sendMail } from "@/lib/mail";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  passwordResetUrl,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const GENERIC_OK =
  "If an account exists for that Profile ID or email, we sent a password reset link. Check your inbox.";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = String(body.identifier ?? "").trim();
    if (!identifier) {
      return NextResponse.json(
        { error: "Enter your Profile ID or email." },
        { status: 400 }
      );
    }

    await ensurePasswordResetSchema();

    const user = await findUserForLogin(identifier);
    // Always return the same message to avoid account enumeration.
    if (!user?.email) {
      return NextResponse.json({ ok: true, message: GENERIC_OK });
    }

    if (user.account_status === "suspended" || user.deletion_requested_at) {
      return NextResponse.json({ ok: true, message: GENERIC_OK });
    }

    const recent = await prisma.$queryRaw<{ created_at: Date }[]>`
      SELECT created_at FROM password_resets
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 1
    `.catch(() => [] as { created_at: Date }[]);

    const last = recent[0]?.created_at;
    if (last && Date.now() - last.getTime() < 60_000) {
      return NextResponse.json({ ok: true, message: GENERIC_OK });
    }

    const token = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.$executeRaw`
      UPDATE password_resets
      SET used_at = NOW()
      WHERE user_id = ${user.id} AND used_at IS NULL
    `.catch(() => undefined);

    await prisma.$executeRaw`
      INSERT INTO password_resets (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt})
    `;

    const resetUrl = passwordResetUrl(token);
    const mail = passwordResetEmail(resetUrl, user.display_name || undefined);
    const sent = await sendMail({ to: user.email, ...mail });

    const payload: {
      ok: true;
      message: string;
      devResetUrl?: string;
    } = { ok: true, message: GENERIC_OK };

    // Local/dev convenience when no real mail provider is configured.
    if (
      process.env.NODE_ENV !== "production" &&
      (sent.via === "console" || process.env.ALLOW_DEV_RESET_LINK === "true")
    ) {
      payload.devResetUrl = resetUrl;
    }

    if (!sent.ok && process.env.NODE_ENV === "production") {
      console.error("forgot-password: mail failed for user", user.id.toString());
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("forgot-password error", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
