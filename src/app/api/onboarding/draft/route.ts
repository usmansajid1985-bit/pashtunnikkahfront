import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { onboardingStage, saveOnboardingDraft } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/** PUT { data, stepIndex } — autosave of the profile answers while onboarding. */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = BigInt(session.userId);
  const { stage } = await onboardingStage(userId);
  if (stage !== "profile") return NextResponse.json({ ok: false, stage }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { data?: Record<string, unknown>; stepIndex?: number } | null;
  if (!body?.data || typeof body.data !== "object") return NextResponse.json({ error: "Invalid draft" }, { status: 400 });
  try {
    await saveOnboardingDraft(userId, { data: body.data, stepIndex: Number(body.stepIndex) || 0 });
  } catch {
    return NextResponse.json({ error: "Draft too large" }, { status: 413 });
  }
  return NextResponse.json({ ok: true });
}
