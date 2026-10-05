import { NextResponse } from "next/server";
import { saveCityPlaceId, verifyCity } from "@/lib/city-search";
import { cityInvalidMessage } from "@/lib/country";
import { isPashtoLevel, occupationIssue, textQualityIssue } from "@/lib/signup";
import { saveHomeCoords } from "@/lib/browse-location";
import { getPhoneCountryCodes } from "@/lib/phone-codes";
import { PHONE_INVALID_MESSAGE, toE164 } from "@/lib/phone";
import { PASSWORD_WEAK_MESSAGE, isBreachedPassword, passwordIssue } from "@/lib/password-strength";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { calcAge, normalizeOpenTo, splitWomenAppearance, type SignupData } from "@/lib/signup";
import { getPlanSettings } from "@/lib/plan-settings";
import { sendVerificationEmail } from "@/lib/email-verification";
import {
  DEFAULT_RADIUS_MILES,
  geocodeCityCountry,
  roundCoord,
} from "@/lib/geo";
import { normalizeRelocation } from "@/lib/relocation";
import { toCountryCode, countryLabel } from "@/lib/country";
import { parseHeightCm } from "@/lib/height";


async function nextProfileCode(gender: string) {
  const prefix = gender === "Sister" || gender.toLowerCase() === "female" ? "PNF" : "PNM";
  const latest = await prisma.profiles.findFirst({
    where: { profile_code: { startsWith: prefix } },
    orderBy: { id: "desc" },
    select: { profile_code: true },
  });
  const num = latest?.profile_code ? Number(latest.profile_code.replace(/\D/g, "")) || 0 : 0;
  return `${prefix}${String(num + 1).padStart(3, "0")}`;
}

async function nextProfileId() {
  const max = await prisma.profiles.aggregate({ _max: { id: true } });
  return (max._max.id ?? 0n) + 1n;
}

async function nextUserId() {
  const max = await prisma.users.aggregate({ _max: { id: true } });
  return (max._max.id ?? 0n) + 1n;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SignupData>;
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const genderLabel = body.gender === "Sister" ? "Female" : body.gender === "Brother" ? "Male" : "";

    if (!email || !password || !fullName || !genderLabel) {
      return NextResponse.json({ error: "Missing required account details." }, { status: 400 });
    }

    // Same password rules as the form, then a breach-list lookup (skipped if it can't be reached).
    const weakPassword = passwordIssue(password, email);
    if (weakPassword) return NextResponse.json({ error: weakPassword }, { status: 400 });
    if ((await isBreachedPassword(password)) === true) {
      return NextResponse.json({ error: PASSWORD_WEAK_MESSAGE }, { status: 400 });
    }

    const age = calcAge(String(body.dob ?? ""));
    if (age == null || age < 18) {
      return NextResponse.json({ error: "You must be 18 or over." }, { status: 400 });
    }

    // About Me / Looking For must be real sentences (same check as the form).
    for (const [value, label] of [
      [body.about, "About you"],
      [body.lookingFor, "What you're looking for"],
    ] as const) {
      const issue = textQualityIssue(String(value ?? ""));
      if (issue) return NextResponse.json({ error: `${label}: ${issue}` }, { status: 400 });
    }

    // Pashto speakers must say how well they speak it; nobody else is asked.
    const speaksPashto = (body.languages ?? []).includes("Pashto");
    if (speaksPashto && !isPashtoLevel(body.pashtoLevel)) {
      return NextResponse.json({ error: "Please tell us how well you speak Pashto." }, { status: 400 });
    }
    const pashtoLevel = speaksPashto ? String(body.pashtoLevel) : null;

    // Career: workers say what they do, students what they study; nobody else is asked.
    const careerIssue = occupationIssue(String(body.employment ?? ""), String(body.occupation ?? ""));
    if (careerIssue) return NextResponse.json({ error: careerIssue }, { status: 400 });

    // Phone: re-validated here against the chosen country's numbering plan and stored as E.164.
    // The country must be one the picker offers (skipped only if that list can't be loaded).
    const phoneCodes = await getPhoneCountryCodes();
    const offered = (iso: string) => !phoneCodes.length || phoneCodes.some((c) => c.iso === iso);
    // Older clients send only the dial code — try each country that uses it (+1: US and Canada).
    const phoneIsos = body.phoneIso
      ? [String(body.phoneIso)]
      : phoneCodes.filter((c) => c.dialCode === body.phoneCountry).map((c) => c.iso);
    let phoneE164: string | null = null;
    for (const iso of phoneIsos.filter(offered)) {
      phoneE164 = toE164(iso, String(body.phone ?? ""));
      if (phoneE164) break;
    }
    if (!phoneE164) return NextResponse.json({ error: PHONE_INVALID_MESSAGE }, { status: 400 });

    // R04: the city must be a real town/city in the chosen country (the form only offers those —
    // this stops a hand-crafted request). If the lookup is down, don't block the signup.
    const cityVerdict = await verifyCity(body.city, body.country, body.cityPlaceId);
    if (cityVerdict.status === "invalid") {
      return NextResponse.json({ error: cityInvalidMessage(body.country), code: "CITY_INVALID" }, { status: 400 });
    }

    const existingUser = await prisma.users.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { profiles: true },
    });
    if (existingUser?.profiles) {
      const redirectTo = `/login?email=${encodeURIComponent(email)}&existing=1`;
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
          code: "EMAIL_EXISTS",
          redirectTo,
        },
        { status: 409 }
      );
    }

    const resumeIncompleteSignup = Boolean(existingUser && !existingUser.profiles);

    const password_hash = await hashPassword(password);
    const profile_code = await nextProfileCode(genderLabel);
    const userId = resumeIncompleteSignup ? existingUser!.id : await nextUserId();

    const womenAppearance = splitWomenAppearance(Array.isArray(body.appearance) ? body.appearance : []);

    // Only the current marital-history options are stored — drops removed ones (e.g. Polygamy)
    // from a crafted or stale client.
    const openTo = normalizeOpenTo(body.openTo);

    // Niqab Mode and Wali-Only Mode no longer exist — reject a crafted/stale value server-side
    // rather than silently persisting it (QA item 12).
    const communicationMode = ["standard", "wali_oversight"].includes(String(body.communicationMode))
      ? String(body.communicationMode)
      : "standard";

    const extras = {
      smoking: body.smoking ?? "",
      vaping: body.vaping ?? "",
      employment: body.employment ?? "",
      communicationMode,
      openTo,
      languages: body.languages ?? [],
      hasPhoto: false, // set below once photos are saved
    };

    // Up to 3 photos, with a selectable main. Legacy single `photoDataUrl` still accepted.
    const legacyPhoto = (body as { photoDataUrl?: string }).photoDataUrl;
    const photoList: string[] = Array.isArray(body.photos)
      ? (body.photos as unknown[]).map(String)
      : legacyPhoto
        ? [String(legacyPhoto)]
        : [];
    const mainIndex = Number.isInteger(body.mainPhotoIndex) ? Number(body.mainPhotoIndex) : 0;

    let photoUrl: string | null = null;
    let photoBlurUrl: string | null = null;
    let photoVerificationUrl: string | null = null;
    if (photoList.length > 0) {
      try {
        const { importSignupPhotos } = await import("@/lib/profile-photos");
        const res = await importSignupPhotos(userId, photoList, mainIndex);
        photoUrl = res.mainUrl;
        photoBlurUrl = res.mainBlurUrl;
        photoVerificationUrl = res.mainUrl;
        extras.hasPhoto = res.count > 0;
      } catch (e) {
        console.error("signup photo save", e);
      }
    }

    const freeSettings = await getPlanSettings("free");

    const countryCode = toCountryCode(body.country);
    const country = countryLabel(countryCode) ?? (String(body.country ?? "").trim() || null);
    const city = String(body.city ?? "").trim() || null;
    // Best-effort pin so Browse "near me" works without a later location setup step.
    const geo = await geocodeCityCountry(city, country);

    const profileId = await nextProfileId();
    const profileData = {
      id: profileId,
      user_id: userId,
      profile_code,
      // Production: await admin approval. Local/dev: show immediately in Browse.
      status: process.env.NODE_ENV === "production" ? "pending" : "approved",
      full_name: fullName,
      gender: genderLabel,
      email,
      dob: body.dob ? new Date(String(body.dob)) : null,
      age,
      height: body.height || null,
      height_cm: parseHeightCm(body.height),
      country,
      country_code: countryCode,
      city,
      location_lat: geo ? roundCoord(geo.lat) : null,
      location_lng: geo ? roundCoord(geo.lng) : null,
      location_city: geo?.city || city,
      location_region: geo?.region || null,
      location_country: geo?.country || country,
      location_country_code: geo?.countryCode || null,
      location_radius_miles: geo ? DEFAULT_RADIUS_MILES : undefined,
      location_country_only: false,
      marital_status: body.maritalStatus || null,
      ancestral_village: body.ancestralRegion || null,
      willing_to_relocate: normalizeRelocation(body.relocation),
      relocate: null,
      home_language: (body.languages ?? []).join(", ") || null,
      pashto_level: pashtoLevel,
      religious_practice: body.religiousPractice || null,
      salah_pattern: body.salah || null,
      appearance:
        genderLabel === "Female"
          ? // Only current head-covering / dress-style values, head covering first.
            [womenAppearance.head, ...womenAppearance.dress].filter(Boolean).join(", ")
          : (body.appearance ?? [])[0] || null,
      education: body.education || null,
      occupation: body.occupation || body.employment || null,
      has_children: body.hasChildren || null,
      wants_children: body.willingChildren || null,
      about_me: body.about || null,
      partner_preferences: body.lookingFor || null,
      open_to: openTo.join(", ") || null,
      phone: phoneE164,
      phone_country_code: body.phoneCountry || null,
      photo_status: photoUrl ? "pending" : null,
      photo_url: photoUrl,
      photo_blur_url: photoBlurUrl,
      photo_verification_url: photoVerificationUrl,
      photo_version: photoUrl ? 1 : null,
      traits: JSON.stringify(extras),
      submitted_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const user = await prisma.$transaction(async (tx) => {
      const savedUser = resumeIncompleteSignup
        ? await tx.users.update({
            where: { id: userId },
            data: {
              password_hash,
              display_name: fullName,
              onboarding_complete: true,
              requests_remaining: freeSettings.monthlyCredits,
              female_mode: genderLabel === "Female",
              updated_at: new Date(),
            },
          })
        : await tx.users.create({
            data: {
              id: userId,
              email,
              password_hash,
              display_name: fullName,
              role: "user",
              account_status: "active",
              email_verified: false,
              onboarding_complete: true,
              plan: "basic",
              requests_remaining: freeSettings.monthlyCredits,
              female_mode: genderLabel === "Female",
              registered_at: new Date(),
              created_at: new Date(),
              updated_at: new Date(),
            },
          });

      if (!resumeIncompleteSignup) {
        const maxLedger = await tx.credit_ledger.aggregate({ _max: { id: true } });
        const ledgerId = (maxLedger._max.id ?? 0n) + 1n;
        await tx.credit_ledger.create({
          data: {
            id: ledgerId,
            user_id: savedUser.id,
            amount: freeSettings.monthlyCredits,
            balance_type: "monthly",
            reason: "monthly_free_allowance",
            previous_balance: 0,
            new_balance: freeSettings.monthlyCredits,
            created_at: new Date(),
          },
        });
      }

      await tx.profiles.create({ data: profileData });
      return savedUser;
    });

    // B07: the member's own (home) coordinates — separate from location_*, which is their
    // Browse search centre and changes whenever they search another area.
    if (geo) await saveHomeCoords(user.id, geo.lat, geo.lng);
    if (cityVerdict.placeId) await saveCityPlaceId(user.id, cityVerdict.placeId);

    if (photoUrl) {
      const { logModeration } = await import("@/lib/moderation");
      await logModeration({
        userId: user.id,
        action: "photo_uploaded",
        note: photoUrl,
      });
    }

    void sendVerificationEmail(user.id).catch((err) =>
      console.error("signup verification email failed", err)
    );

    const token = await createSessionToken({
      userId: user.id.toString(),
      email: user.email,
      displayName: fullName,
      profileCode: profile_code,
      plan: "basic",
    });

    const res = NextResponse.json({
      ok: true,
      profileCode: profile_code,
      redirectTo: "/browse",
      verifyEmail: true,
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error("signup error", err);
    return NextResponse.json({ error: "Could not create your account. Try again." }, { status: 500 });
  }
}
