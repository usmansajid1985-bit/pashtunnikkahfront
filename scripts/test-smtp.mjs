import "dotenv/config";
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.MAIL_FROM || user;
const to = user;

if (!host || !user || !pass) {
  console.error("Missing SMTP_HOST, SMTP_USER, or SMTP_PASS in .env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: { user, pass },
});

console.log("Verifying SMTP connection...");
await transporter.verify();
console.log("SMTP verify OK");

const info = await transporter.sendMail({
  from,
  to,
  subject: `Pashtun Nikah SMTP test ${new Date().toISOString()}`,
  text: "If you received this, Gmail SMTP is configured correctly for Pashtun Nikah.",
  html: "<p>If you received this, <strong>Gmail SMTP</strong> is configured correctly for Pashtun Nikah.</p>",
});

console.log("Sent:", info.messageId);
console.log("To:", to);
console.log("Via:", host);
