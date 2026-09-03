import { createHash, randomBytes } from "crypto";
import { ensureEmailVerificationSchema } from "@/lib/ensure-email-verification-schema";
import { verificationEmail, sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, hashPasswordResetToken, generatePasswordResetToken } from "@/lib/password-reset";

export function verificationUrl(token: string) {
  return `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(userId: bigint) {
  await ensureEmailVerificationSchema();

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, email: true, display_name: true, email_verified: true },
  });
  if (!user || user.email_verified || !user.email) {
    return { ok: false as const, reason: "not_needed" as const };
  }

  const recent = await prisma.$queryRaw<{ created_at: Date }[]>`
    SELECT created_at FROM email_verification_tokens
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `.catch(() => [] as { created_at: Date }[]);

  const last = recent[0]?.created_at;
  if (last && Date.now() - last.getTime() < 60_000) {
    return { ok: true as const, throttled: true as const };
  }

  const token = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.$executeRaw`
    UPDATE email_verification_tokens
    SET used_at = NOW()
    WHERE user_id = ${userId} AND used_at IS NULL
  `.catch(() => undefined);

  await prisma.$executeRaw`
    INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  const url = verificationUrl(token);
  const mail = verificationEmail(url, user.display_name || undefined);
  const sent = await sendMail({ to: user.email, ...mail });

  return {
    ok: sent.ok,
    via: sent.via,
    devVerifyUrl:
      process.env.NODE_ENV !== "production" &&
      (sent.via === "console" || process.env.ALLOW_DEV_RESET_LINK === "true")
        ? url
        : undefined,
  };
}

export async function consumeVerificationToken(token: string) {
  await ensureEmailVerificationSchema();
  const tokenHash = hashPasswordResetToken(token);

  const rows = await prisma.$queryRaw<
    { id: bigint; user_id: bigint; expires_at: Date; used_at: Date | null }[]
  >`
    SELECT id, user_id, expires_at, used_at FROM email_verification_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `.catch(
    () => [] as { id: bigint; user_id: bigint; expires_at: Date; used_at: Date | null }[]
  );

  const row = rows[0];
  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
    return { ok: false as const, error: "This verification link is invalid or has expired." };
  }

  await prisma.users.update({
    where: { id: row.user_id },
    data: { email_verified: true, updated_at: new Date() },
  });

  await prisma.$executeRaw`
    UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ${row.id}
  `;

  return { ok: true as const, userId: row.user_id };
}

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
