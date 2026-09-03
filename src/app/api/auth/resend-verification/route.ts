import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email-verification";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await sendVerificationEmail(BigInt(session.userId));
    if (result.ok === false && result.reason === "not_needed") {
      return NextResponse.json({ ok: true, message: "Email already verified." });
    }

    const payload: { ok: true; message: string; devVerifyUrl?: string } = {
      ok: true,
      message: result.throttled
        ? "Verification email sent recently. Check your inbox."
        : "Verification email sent. Check your inbox.",
    };
    if ("devVerifyUrl" in result && result.devVerifyUrl) {
      payload.devVerifyUrl = result.devVerifyUrl;
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error("resend-verification error", err);
    return NextResponse.json({ error: "Could not send verification email." }, { status: 500 });
  }
}
