import { NextResponse } from "next/server";
import { saveCityPlaceId, verifyCity } from "@/lib/city-search";
import { cityInvalidMessage } from "@/lib/country";
import { textQualityIssue } from "@/lib/signup";
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

    // About Me / Looking For: a changed text must be real sentences of 30+ words. Untouched
    // older profiles aren't blocked from saving other fields.
    for (const [key, col, label] of [
      ["aboutMe", "about_me", "About Me"],
      ["lookingFor", "partner_preferences", "What you're looking for"],
    ] as const) {
      const next = typeof body[key] === "string" ? body[key].trim() : null;
      if (next !== null && next !== (existing[col] ?? "").trim()) {
        const issue = textQualityIssue(next);
        if (issue) return NextResponse.json({ error: `${label}: ${issue}`, field: key }, { status: 400 });
      }
    }

    // R04: the city must be a real town/city in the profile's country. Re-checked whenever the
    // city OR the country changes (a new country invalidates the old city); unchanged legacy
    // values are left alone.
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const cityAfter = has("city") ? String(body.city ?? "").trim() : (existing.city ?? "").trim();
    const countryAfter = has("country") ? String(body.country ?? "") : existing.country;
    const cityChanged = cityAfter !== (existing.city ?? "").trim();
    const countryChanged =
      has("country") && toCountryCode(countryAfter) !== (existing.country_code ?? toCountryCode(existing.country));
    let verifiedPlaceId: string | null = null;
    if (cityChanged || countryChanged) {
      const verdict = cityAfter
        ? await verifyCity(cityAfter, countryAfter, body.cityPlaceId)
        : { status: countryChanged ? ("invalid" as const) : ("ok" as const), placeId: null };
      if (verdict.status === "invalid") {
        return NextResponse.json({ error: cityInvalidMessage(countryAfter), field: "city" }, { status: 400 });
      }
      verifiedPlaceId = verdict.placeId;
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
    // Only fields the caller actually sent are written — a partial update (e.g. just Salah) must
    // never blank the rest of the profile.
    const sent = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const ifSent = <T,>(key: string, value: T) => (sent(key) ? value : undefined);
    const contentChanged =
      (sent("fullName") && (String(body.fullName ?? "").trim() || existing.full_name) !== existing.full_name) ||
      (sent("height") && (body.height || null) !== existing.height) ||
      (sent("city") && (body.city || null) !== existing.city) ||
      (sent("country") && nextCountryCode !== existing.country_code) ||
      (sent("maritalStatus") && (body.maritalStatus || null) !== existing.marital_status) ||
      (sent("tribe") && (body.tribe || null) !== existing.tribe) ||
      (sent("ancestralRegion") && (body.ancestralRegion || null) !== existing.ancestral_village) ||
      (sent("relocation") && nextRelocation !== existing.willing_to_relocate) ||
      (sent("religiousPractice") && (body.religiousPractice || null) !== existing.religious_practice) ||
      (sent("islamicBackground") && (body.islamicBackground || null) !== existing.religious_methodology) ||
      (sent("appearance") && appearance !== existing.appearance) ||
      (sent("hasChildren") && (body.hasChildren || null) !== existing.has_children) ||
      (sent("willingChildren") && (body.willingChildren || null) !== existing.wants_children) ||
      (sent("education") && (body.education || null) !== existing.education) ||
      ((sent("occupation") || sent("employment")) && nextOccupation !== existing.occupation) ||
      nextHomeLanguage !== existing.home_language ||
      (sent("aboutMe") && (body.aboutMe || null) !== existing.about_me) ||
      (sent("lookingFor") && (body.lookingFor || null) !== existing.partner_preferences);

    // F01: an approved member keeps their Approved status when they edit. Content changes are
    // time-stamped for admin re-review instead of pulling the member back into Awaiting Approval.
    const flagForReview = existing.status === "approved" && contentChanged;

    await prisma.profiles.update({
      where: { user_id: userId },
      data: {
        full_name: String(body.fullName ?? existing.full_name ?? "").trim() || existing.full_name,
        height: ifSent("height", body.height || null),
        height_cm: ifSent("height", parseHeightCm(body.height)),
        city: ifSent("city", body.city || null),
        // Canonical country — store the ISO code and derive a clean display name from it.
        country_code: ifSent("country", nextCountryCode),
        country: ifSent("country", countryLabel(nextCountryCode) ?? (body.country || null)),
        marital_status: ifSent("maritalStatus", body.maritalStatus || null),
        tribe: ifSent("tribe", body.tribe || null),
        ancestral_village: ifSent("ancestralRegion", body.ancestralRegion || null),
        // One canonical relocation value; legacy `relocate` column no longer written.
        willing_to_relocate: ifSent("relocation", nextRelocation),
        relocate: ifSent("relocation", null),
        religious_practice: ifSent("religiousPractice", body.religiousPractice || null),
        salah_pattern: ifSent("salah", body.salah || null),
        religious_methodology: ifSent("islamicBackground", body.islamicBackground || null),
        appearance: ifSent("appearance", appearance),
        has_children: ifSent("hasChildren", body.hasChildren || null),
        wants_children: ifSent("willingChildren", body.willingChildren || null),
        education: ifSent("education", body.education || null),
        occupation: sent("occupation") || sent("employment") ? nextOccupation : undefined,
        home_language: ifSent("languages", nextHomeLanguage),
        about_me: ifSent("aboutMe", body.aboutMe || null),
        partner_preferences: ifSent("lookingFor", body.lookingFor || null),
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
    if ((sent("city") || sent("country")) && ((body.city || null) !== existing.city || nextCountry !== existing.country)) {
      await refreshHomeCoords(userId, body.city || null, nextCountry);
    }
    // Keep the stored place id in step with the city (cleared if it couldn't be confirmed).
    if (cityChanged || countryChanged) await saveCityPlaceId(userId, verifiedPlaceId);
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
