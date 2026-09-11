import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { normalizeRelocation } from "@/lib/relocation";
import { toCountryCode, countryLabel } from "@/lib/country";
import { parseHeightCm } from "@/lib/height";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = BigInt(session.userId);
  const user = await prisma.users.findUnique({ where: { id: userId } });
  const profile = await prisma.profiles.findUnique({ where: { user_id: userId } });
  if (!user || !profile) return NextResponse.json({ error: "No profile" }, { status: 404 });

  return NextResponse.json({ profile: mapProfileView(profile, user) });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const userId = BigInt(session.userId);
    const existing = await prisma.profiles.findUnique({ where: { user_id: userId } });
    if (!existing) return NextResponse.json({ error: "No profile" }, { status: 404 });

    let extras: Record<string, unknown> = {};
    try {
      extras = existing.traits ? JSON.parse(existing.traits) : {};
    } catch {
      extras = {};
    }

    extras = {
      ...extras,
      smoking: body.smoking ?? extras.smoking ?? "",
      vaping: body.vaping ?? extras.vaping ?? "",
      employment: body.employment ?? extras.employment ?? "",
      languages: body.languages ?? extras.languages ?? [],
    };

    const appearance = Array.isArray(body.appearance)
      ? body.appearance.join(", ")
      : body.appearance || existing.appearance;
    const nextCountryCode = toCountryCode(body.country);
    const nextRelocation = normalizeRelocation(body.relocation);
    const nextOccupation = body.occupation || body.employment || null;
    const nextHomeLanguage = Array.isArray(body.languages)
      ? body.languages.join(", ")
      : existing.home_language;

    // Pause Profile (visibility only) is submitted through this same form/endpoint as everything
    // else, so re-review must be keyed on whether a moderation-relevant field actually changed —
    // not "was this endpoint called while approved". Toggling Pause on its own must not send an
    // approved profile back through review (PN-SETTINGS-007).
    const contentChanged =
      (String(body.fullName ?? "").trim() || existing.full_name) !== existing.full_name ||
      (body.height || null) !== existing.height ||
      (body.city || null) !== existing.city ||
      nextCountryCode !== existing.country_code ||
      (body.maritalStatus || null) !== existing.marital_status ||
      (body.tribe || null) !== existing.tribe ||
      (body.ancestralRegion || null) !== existing.ancestral_village ||
      nextRelocation !== existing.willing_to_relocate ||
      (body.religiousPractice || null) !== existing.religious_practice ||
      (body.islamicBackground || null) !== existing.religious_methodology ||
      appearance !== existing.appearance ||
      (body.hasChildren || null) !== existing.has_children ||
      (body.willingChildren || null) !== existing.wants_children ||
      (body.education || null) !== existing.education ||
      nextOccupation !== existing.occupation ||
      nextHomeLanguage !== existing.home_language ||
      (body.aboutMe || null) !== existing.about_me ||
      (body.lookingFor || null) !== existing.partner_preferences;

    const needsReview = existing.status === "approved" && contentChanged;

    await prisma.profiles.update({
      where: { user_id: userId },
      data: {
        full_name: String(body.fullName ?? existing.full_name ?? "").trim() || existing.full_name,
        height: body.height || null,
        height_cm: parseHeightCm(body.height),
        city: body.city || null,
        // Canonical country — store the ISO code and derive a clean display name from it.
        country_code: nextCountryCode,
        country: countryLabel(nextCountryCode) ?? (body.country || null),
        marital_status: body.maritalStatus || null,
        tribe: body.tribe || null,
        ancestral_village: body.ancestralRegion || null,
        // One canonical relocation value; legacy `relocate` column no longer written.
        willing_to_relocate: nextRelocation,
        relocate: null,
        religious_practice: body.religiousPractice || null,
        religious_methodology: body.islamicBackground || null,
        appearance,
        has_children: body.hasChildren || null,
        wants_children: body.willingChildren || null,
        education: body.education || null,
        occupation: nextOccupation,
        home_language: nextHomeLanguage,
        about_me: body.aboutMe || null,
        partner_preferences: body.lookingFor || null,
        is_hidden: Boolean(body.isHidden),
        traits: JSON.stringify(extras),
        status: needsReview ? "pending" : existing.status,
        updated_at: new Date(),
      },
    });

    if (body.fullName) {
      await prisma.users.update({
        where: { id: userId },
        data: { display_name: String(body.fullName).trim(), updated_at: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("profile patch", err);
    return NextResponse.json({ error: "Could not save profile." }, { status: 500 });
  }
}
