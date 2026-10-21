import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX_SCREENSHOTS,
  saveFeedback,
  saveFeedbackScreenshot,
  type FeedbackKind,
} from "@/lib/feedback";

export const dynamic = "force-dynamic";

/** Settings → Give us feedback. Multipart: kind, subject, message, screenshots[] (≤3 images). */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Couldn't read your feedback — please try again." }, { status: 400 });

  const kind = String(form.get("kind") || "general") as FeedbackKind;
  if (!FEEDBACK_KINDS.includes(kind)) return NextResponse.json({ error: "Choose a feedback type." }, { status: 400 });
  const subject = String(form.get("subject") || "").trim().slice(0, 160);
  const message = String(form.get("message") || "").trim().slice(0, 4000);
  if (subject.length < 3) return NextResponse.json({ error: "Add a short subject." }, { status: 400 });
  if (message.length < 10) return NextResponse.json({ error: "Tell us a little more in the message." }, { status: 400 });

  const files = form.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > FEEDBACK_MAX_SCREENSHOTS) {
    return NextResponse.json({ error: `You can add up to ${FEEDBACK_MAX_SCREENSHOTS} screenshots.` }, { status: 400 });
  }

  const userId = BigInt(session.userId);
  try {
    const screenshots: string[] = [];
    for (const f of files) screenshots.push(await saveFeedbackScreenshot(userId, f));
    const id = await saveFeedback({
      userId,
      kind,
      subject,
      message,
      screenshots,
      userAgent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[feedback] save failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't send your feedback — please try again." },
      { status: 400 }
    );
  }
}
