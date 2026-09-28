import { NextResponse } from "next/server";
import { verifyCity } from "@/lib/city-search";
import { refreshHomeCoords } from "@/lib/browse-location";
import { ensureBrowseAndWaliSchema } from "@/lib/ensure-browse-schema";
import { withOwnerPhotoUrls } from "@/lib/photos";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastBrowseVisibility } from "@/lib/chat-broadcast";
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

  return NextResponse.json({ profile: await withOwnerPhotoUrls(mapProfileView(profile, user)) });
}

const TEXT_LIMITS: [field: string, label: string, max: number][] = [
  ["fullName", "Name", 120],
  ["city", "City", 128],
  ["tribe", "Tribe", 128],
  ["education", "Education", 128],
  ["occupation", "Profession", 100],
  ["employment", "Profession", 100],
  ["aboutMe", "About Me", 2000],
  ["lookingFor", "Partner preferences", 2000],
];

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const raw = await req.json();
    // P03: whitespace-only text is treated as empty everywhere.
    const body = Object.fromEntries(
      Object.entries(raw ?? {}).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
    ) as typeof raw;
    // P05: clear, field-specific limits instead of a generic "Could not save profile.".
    for (const [field, label, max] of TEXT_LIMITS) {
      const v = body[field];
      if (typeof v === "string" && v.length > max) {
        return NextResponse.json(
          { error: `${label} is too long — please keep it under ${max} characters.`, field },
          { status: 400 }
        );
      }
    }
    const userId = BigInt(session.userId);
    const existing = await prisma.profiles.findUnique({ where: { user_id: userId } });
    if (!existing) return NextResponse.json({ error: "No profile" }, { status: 404 });

    // R04: a changed city must be a real place. Unchanged legacy values are left alone.
    const cityChanged =
      typeof body.city === "string" && body.city.trim() !== (existing.city ?? "").trim();
    if (cityChanged && (await verifyCity(body.city, body.country)) === "invalid") {
      return NextResponse.json(
        { error: "Please choose your city from the suggestions list." },
        { status: 400 }
      );
    }

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

    // F01: an approved member keeps their Approved status when they edit. Content changes are
    // time-stamped for admin re-review instead of pulling the member back into Awaiting Approval.
    const flagForReview = existing.status === "approved" && contentChanged;

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
        // Only touch Pause when the caller actually sent it — never un-pause as a side effect.
        ...(typeof body.isHidden === "boolean" ? { is_hidden: body.isHidden } : {}),
        traits: JSON.stringify(extras),
        updated_at: new Date(),
      },
    });
    // S03/S04: pausing/resuming from Edit Profile updates other members' Browse live too.
    if (typeof body.isHidden === "boolean" && body.isHidden !== existing.is_hidden) {
      broadcastBrowseVisibility(userId, !body.isHidden);
    }
    // B07: keep home coordinates in step with the member's city.
    const nextCountry = countryLabel(nextCountryCode) ?? (body.country || null);
    if ((body.city || null) !== existing.city || nextCountry !== existing.country) {
      await refreshHomeCoords(userId, body.city || null, nextCountry);
    }
    if (flagForReview) {
      await ensureBrowseAndWaliSchema();
      await prisma.$executeRaw`UPDATE profiles SET edited_since_review_at = NOW() WHERE user_id = ${userId}`.catch(
        () => undefined
      );
    }

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
