import nodemailer from "nodemailer";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Sends transactional email.
 * Priority: RESEND_API_KEY → SMTP (SMTP_HOST) → console log (dev).
 */
export async function sendMail(input: SendMailInput): Promise<{ ok: boolean; via: string }> {
  const from =
    process.env.MAIL_FROM ||
    process.env.EMAIL_FROM ||
    "Pashtun Nikah <noreply@pashtunnikah.com>";

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Resend mail failed", res.status, body);
      return { ok: false, via: "resend" };
    }
    return { ok: true, via: "resend" };
  }

  const host = process.env.SMTP_HOST;
  if (host) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
      await transporter.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return { ok: true, via: "smtp" };
    } catch (err) {
      console.error("SMTP mail failed", err);
      return { ok: false, via: "smtp" };
    }
  }

  console.info(
    `[mail:dev] to=${input.to} subject=${JSON.stringify(input.subject)}\n${input.text}`
  );
  return { ok: true, via: "console" };
}

export function passwordResetEmail(resetUrl: string, displayName?: string) {
  const name = displayName?.trim() || "there";
  const subject = "Reset your Pashtun Nikah password";
  const text = `Assalamu alaikum ${name},

We received a request to reset your Pashtun Nikah password.

Open this link to choose a new password (expires in 1 hour):
${resetUrl}

If you did not ask for this, you can ignore this email.

— Pashtun Nikah`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1c1917;line-height:1.5">
      <p>Assalamu alaikum ${escapeHtml(name)},</p>
      <p>We received a request to reset your Pashtun Nikah password.</p>
      <p style="margin:28px 0">
        <a href="${escapeHtml(resetUrl)}"
           style="display:inline-block;background:#aa1945;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-family:system-ui,sans-serif;font-weight:600">
          Reset password
        </a>
      </p>
      <p style="font-size:14px;color:#57534e">This link expires in 1 hour. If you did not ask for this, you can ignore this email.</p>
      <p style="font-size:13px;color:#78716c">Or paste this URL into your browser:<br>${escapeHtml(resetUrl)}</p>
    </div>
  `;
  return { subject, text, html };
}

export function verificationEmail(verifyUrl: string, displayName?: string) {
  const name = displayName?.trim() || "there";
  const subject = "Verify your Pashtun Nikah email";
  const text = `Assalamu alaikum ${name},

Please verify your email to send match introductions on Pashtun Nikah.

Open this link (expires in 24 hours):
${verifyUrl}

— Pashtun Nikah`;
  const html = `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1c1917;line-height:1.5">
      <p>Assalamu alaikum ${escapeHtml(name)},</p>
      <p>Please verify your email to send match introductions on Pashtun Nikah.</p>
      <p style="margin:28px 0">
        <a href="${escapeHtml(verifyUrl)}"
           style="display:inline-block;background:#aa1945;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-family:system-ui,sans-serif;font-weight:600">
          Verify email
        </a>
      </p>
      <p style="font-size:14px;color:#57534e">This link expires in 24 hours.</p>
      <p style="font-size:13px;color:#78716c">Or paste this URL into your browser:<br>${escapeHtml(verifyUrl)}</p>
    </div>
  `;
  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
