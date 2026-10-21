import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { removeStoredPhotos } from "@/lib/photos";
import { siteOrigin as appOrigin } from "@/lib/site-url";

/**
 * N54: closing an account. The member picks a reason and confirms; the profile is hidden at once
 * and the account is kept for 30 days. Logging in within those 30 days reactivates it. After 30
 * days the daily job deletes it: an email goes out first, then personal data is wiped (name,
 * email, phone, photos, guardians, push devices…) and open matches/requests are closed. Rows other
 * members still reference (their chat history) remain, attributed to "Deleted member".
 */

import { DELETION_GRACE_DAYS, DELETION_REASONS, type DeletionReasonCode } from "@/lib/account-deletion-shared";
export { DELETION_GRACE_DAYS, DELETION_REASONS, type DeletionReasonCode } from "@/lib/account-deletion-shared";

const DAY = 24 * 60 * 60 * 1000;

let ensured = false;
async function ensureDeletionSchema() {
  if (ensured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS deletion_hid_profile BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
    `);
    ensured = true;
  } catch (err) {
    console.error("ensureDeletionSchema", err);
  }
}

export function deletionDate(requestedAt: Date) {
  return new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * DAY);
}

function longDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}


function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailLayout(name: string, paragraphs: string[], button?: { label: string; url: string }) {
  const text = [`Assalamu alaikum ${name},`, "", ...paragraphs.flatMap((p) => [p, ""]), button ? `${button.label}: ${button.url}\n` : "", "— Pashtun Nikah"].join("\n");
  const html = `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1c1917;line-height:1.5">
      <p>Assalamu alaikum ${escapeHtml(name)},</p>
      ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      ${
        button
          ? `<p style="margin:28px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#aa1945;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-family:system-ui,sans-serif;font-weight:600">${escapeHtml(button.label)}</a></p>`
          : ""
      }
      <p style="font-size:14px;color:#57534e">— Pashtun Nikah</p>
    </div>`;
  return { text, html };
}

/** Confirmed on Settings → Close account. */
export async function scheduleAccountDeletion(userId: bigint, reason: DeletionReasonCode, otherText: string) {
  await ensureDeletionSchema();
  const label = DELETION_REASONS.find((r) => r.code === reason)?.label ?? "Other.";
  const stored = reason === "other" && otherText.trim() ? `${label} ${otherText.trim()}` : label;
  const now = new Date();

  const profile = await prisma.profiles.findUnique({ where: { user_id: userId }, select: { is_hidden: true, full_name: true } });
  const user = await prisma.users.update({
    where: { id: userId },
    data: {
      deletion_requested_at: now,
      deletion_reason: stored.slice(0, 500),
      account_status: "pending_deletion",
      updated_at: now,
    },
    select: { email: true, display_name: true },
  });
  // Hidden from Browse straight away; remember whether we hid it so reactivation can undo just that.
  await prisma.$executeRawUnsafe(`UPDATE users SET deletion_hid_profile = $2 WHERE id = $1`, userId, !profile?.is_hidden);
  if (profile && !profile.is_hidden) {
    await prisma.profiles.update({ where: { user_id: userId }, data: { is_hidden: true, updated_at: now } });
  }

  const name = (profile?.full_name || user.display_name || "there").split(" ")[0];
  const until = longDate(deletionDate(now));
  const mail = emailLayout(
    name,
    [
      "We've received your request to close your Pashtun Nikah account. Your profile is now hidden and no one can find you in Browse.",
      `Your account will be permanently deleted on ${until}. If you change your mind, simply log in before then and your account will be reactivated.`,
      "Jazakallahu khairan for being part of our community.",
    ],
    { label: "Log in to keep my account", url: `${appOrigin()}/login` }
  );
  await sendMail({ to: user.email, subject: "Your Pashtun Nikah account will be deleted", ...mail }).catch((err) =>
    console.error("[account-deletion] schedule email failed", err)
  );
  return { deleteOn: deletionDate(now) };
}

type LoginUser = { id: bigint; email: string; display_name: string; account_status: string; deletion_requested_at: Date | null };

/**
 * Login of an account that asked to be deleted: within 30 days it's reactivated (returns
 * "reactivated"); after that it's gone ("expired" — the job may not have run yet).
 */
export async function reactivateOnLogin(user: LoginUser): Promise<"reactivated" | "expired" | "legacy" | "none"> {
  if (!user.deletion_requested_at) return "none";
  // Requests from before this flow ('deletion_requested') wait for an admin decision.
  if (user.account_status !== "pending_deletion") return "legacy";
  if (Date.now() >= deletionDate(user.deletion_requested_at).getTime()) return "expired";
  await ensureDeletionSchema();
  const rows = await prisma.$queryRawUnsafe<{ deletion_hid_profile: boolean }[]>(
    `SELECT deletion_hid_profile FROM users WHERE id = $1`,
    user.id
  );
  const now = new Date();
  await prisma.users.update({
    where: { id: user.id },
    data: { deletion_requested_at: null, deletion_reason: null, account_status: "active", updated_at: now },
  });
  await prisma.$executeRawUnsafe(`UPDATE users SET deletion_hid_profile = FALSE WHERE id = $1`, user.id);
  if (rows[0]?.deletion_hid_profile) {
    await prisma.profiles.updateMany({ where: { user_id: user.id }, data: { is_hidden: false, updated_at: now } });
  }
  const name = (user.display_name || "there").split(" ")[0];
  const mail = emailLayout(name, [
    "Welcome back! Your Pashtun Nikah account has been reactivated and will not be deleted.",
    "Your profile is visible again in Browse. If you didn't log in just now, please change your password.",
  ]);
  void sendMail({ to: user.email, subject: "Your Pashtun Nikah account has been reactivated", ...mail }).catch(() => {});
  return "reactivated";
}

/** Daily job: delete every account whose 30 days are up. */
export async function purgeExpiredDeletions(limit = 50): Promise<{ deleted: number }> {
  await ensureDeletionSchema();
  const due = await prisma.$queryRawUnsafe<{ id: bigint; email: string; display_name: string }[]>(
    `SELECT id, email, display_name FROM users
      WHERE deletion_requested_at IS NOT NULL AND deleted_at IS NULL
        -- Only accounts closed through this flow. Older 'deletion_requested' rows (from before
        -- N54) are never purged automatically — they need an admin decision first.
        AND account_status = 'pending_deletion'
        AND deletion_requested_at <= NOW() - ($1::int * INTERVAL '1 day')
      ORDER BY deletion_requested_at LIMIT $2`,
    DELETION_GRACE_DAYS,
    limit
  );
  let deleted = 0;
  for (const u of due) {
    try {
      await deleteAccountNow(u);
      deleted++;
    } catch (err) {
      console.error(`[account-deletion] purge failed for ${u.id}`, err);
    }
  }
  return { deleted };
}

async function deleteAccountNow(u: { id: bigint; email: string; display_name: string }) {
  const userId = u.id;
  const profile = await prisma.profiles.findUnique({
    where: { user_id: userId },
    select: { full_name: true, photo_url: true, photo_blur_url: true, photo_verification_url: true },
  });
  const photos = await prisma.$queryRawUnsafe<{ url: string | null; blur_url: string | null }[]>(
    `SELECT url, blur_url FROM profile_photos WHERE user_id = $1`,
    userId
  ).catch(() => []);

  // Tell them first, while we still have their address.
  const name = (profile?.full_name || u.display_name || "there").split(" ")[0];
  const mail = emailLayout(name, [
    `As requested ${DELETION_GRACE_DAYS} days ago, your Pashtun Nikah account and profile have now been permanently deleted.`,
    "Thank you for being part of our community. May Allah grant you what is best. You're always welcome to join again.",
  ]);
  await sendMail({ to: u.email, subject: "Your Pashtun Nikah account has been deleted", ...mail }).catch((err) =>
    console.error("[account-deletion] deleted email failed", err)
  );

  await removeStoredPhotos([
    profile?.photo_url,
    profile?.photo_blur_url,
    profile?.photo_verification_url,
    ...photos.flatMap((p) => [p.url, p.blur_url]),
  ]);

  const now = new Date();
  const run = (sql: string) => prisma.$executeRawUnsafe(sql, userId).catch((err) => console.error("[account-deletion]", sql.slice(0, 60), err));
  // Close anything still open with other members.
  await run(`UPDATE match_requests SET status = 'cancelled', updated_at = NOW() WHERE status = 'pending' AND (sender_id = $1 OR receiver_id = $1)`);
  await run(`UPDATE match_requests SET status = 'ended', ended_at = NOW(), end_reason = 'account_deleted', updated_at = NOW()
              WHERE status = 'accepted' AND (sender_id = $1 OR receiver_id = $1)`);
  await run(`DELETE FROM profile_photos WHERE user_id = $1`);
  await run(`DELETE FROM push_subscriptions WHERE user_id = $1`);
  await run(`DELETE FROM profile_guardians WHERE user_id = $1`);
  await run(`DELETE FROM favourites WHERE user_id = $1 OR profile_user_id = $1`);
  await run(`UPDATE wali_links SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`);

  // Wipe personal details but keep the row so other members' chat history stays intact.
  await prisma.profiles.updateMany({
    where: { user_id: userId },
    data: {
      full_name: "Deleted member",
      email: null,
      phone: null,
      phone_country_code: null,
      dob: null,
      about_me: null,
      partner_preferences: null,
      father_name: null,
      father_occupation: null,
      photo_url: null,
      photo_blur_url: null,
      photo_verification_url: null,
      photo_status: null,
      location_lat: null,
      location_lng: null,
      current_location: null,
      is_hidden: true,
      status: "deleted",
      updated_at: now,
    },
  });
  await prisma.users.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@deleted.pashtunnikah.invalid`,
      display_name: "Deleted member",
      password_hash: "",
      account_status: "deleted",
      updated_at: now,
    },
  });
  await prisma.$executeRawUnsafe(`UPDATE users SET deleted_at = NOW() WHERE id = $1`, userId);
}

/**
 * One-off: deletion requests made before this flow (status 'deletion_requested') get a fresh
 * 30 days from now on the new flow — hidden profile, the "will be deleted on … unless you log in"
 * email, then the daily job deletes them. Their original reason is kept. `dryRun` changes nothing.
 */
export async function startFreshWindowForLegacyRequests(opts: { dryRun: boolean }) {
  await ensureDeletionSchema();
  const rows = await prisma.$queryRawUnsafe<
    { id: bigint; email: string; display_name: string; full_name: string | null; profile_code: string | null; is_hidden: boolean | null }[]
  >(
    `SELECT u.id, u.email, u.display_name, p.full_name, p.profile_code, p.is_hidden
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.deletion_requested_at IS NOT NULL AND u.deleted_at IS NULL AND u.account_status = 'deletion_requested'
      ORDER BY u.deletion_requested_at`
  );
  const now = new Date();
  const until = longDate(deletionDate(now));
  const results: { id: string; code: string | null; emailed: boolean }[] = [];
  for (const r of rows) {
    if (opts.dryRun) {
      results.push({ id: r.id.toString(), code: r.profile_code, emailed: false });
      continue;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE users SET account_status = 'pending_deletion', deletion_requested_at = $2, deletion_hid_profile = $3, updated_at = NOW() WHERE id = $1`,
      r.id,
      now,
      r.is_hidden === false
    );
    if (r.is_hidden === false) {
      await prisma.profiles.updateMany({ where: { user_id: r.id }, data: { is_hidden: true, updated_at: now } });
    }
    const name = (r.full_name || r.display_name || "there").split(" ")[0];
    const mail = emailLayout(
      name,
      [
        "Some time ago you asked us to close your Pashtun Nikah account. We've now moved to a new process, and your profile is hidden so no one can find you in Browse.",
        `Your account will be permanently deleted on ${until}. If you'd like to keep it after all, simply log in before then and it will be reactivated.`,
        "Jazakallahu khairan for being part of our community.",
      ],
      { label: "Log in to keep my account", url: `${appOrigin()}/login` }
    );
    const sent = await sendMail({ to: r.email, subject: "Your Pashtun Nikah account will be deleted", ...mail })
      .then((x) => x.ok)
      .catch((err) => {
        console.error(`[account-deletion] legacy email failed for ${r.id}`, err);
        return false;
      });
    results.push({ id: r.id.toString(), code: r.profile_code, emailed: sent });
  }
  return { count: rows.length, deleteOn: deletionDate(now).toISOString(), results };
}
