import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadOnboardingDraft, onboardingStage } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/** Where the visitor is in onboarding, plus their saved progress (signed-in members only). */
export async function GET() {
  const session = await getSession();
  const userId = session ? BigInt(session.userId) : null;
  const { stage, email } = await onboardingStage(userId);
  const draft = userId && stage === "profile" ? await loadOnboardingDraft(userId) : null;
  return NextResponse.json(
    { stage, email: email ?? null, userId: session?.userId ?? null, draft },
    { headers: { "Cache-Control": "no-store" } }
  );
}
