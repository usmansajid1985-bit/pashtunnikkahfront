import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { calcAge, type SignupData } from "@/lib/signup";
import { getPlanSettings } from "@/lib/plan-settings";
import { sendVerificationEmail } from "@/lib/email-verification";
import {
  DEFAULT_RADIUS_MILES,
  geocodeCityCountry,
  roundCoord,
} from "@/lib/geo";

function stripCountryFlag(country: string) {
  return country.replace(/^[\u{1F1E6}-\u{1F1FF}\s]+/u, "").trim() || country;
}

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

    if (!email || !password || password.length < 8 || !fullName || !genderLabel) {
      return NextResponse.json({ error: "Missing required account details." }, { status: 400 });
    }

    const age = calcAge(String(body.dob ?? ""));
    if (age == null || age < 18) {
      return NextResponse.json({ error: "You must be 18 or over." }, { status: 400 });
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

    const extras = {
      smoking: body.smoking ?? "",
      vaping: body.vaping ?? "",
      employment: body.employment ?? "",
      communicationMode: body.communicationMode ?? "",
      niqabSubMode: body.niqabSubMode ?? "",
      openTo: body.openTo ?? [],
      languages: body.languages ?? [],
      hasPhoto: Boolean(body.photoDataUrl),
    };

    let photoUrl: string | null = null;
    let photoVerificationUrl: string | null = null;
    if (body.photoDataUrl) {
      try {
        const { saveDataUrlPhoto } = await import("@/lib/photos");
        const saved = await saveDataUrlPhoto(userId, String(body.photoDataUrl), "public");
        photoUrl = saved.url;
        if ((body as { verificationPhotoDataUrl?: string }).verificationPhotoDataUrl) {
          const ver = await saveDataUrlPhoto(
            userId,
            String((body as { verificationPhotoDataUrl?: string }).verificationPhotoDataUrl),
            "verification"
          );
          photoVerificationUrl = ver.url;
        }
      } catch (e) {
        console.error("signup photo save", e);
      }
    }

    const freeSettings = await getPlanSettings("free");

    const country = stripCountryFlag(String(body.country ?? "")) || null;
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
      country,
      city,
      location_lat: geo ? roundCoord(geo.lat) : null,
      location_lng: geo ? roundCoord(geo.lng) : null,
      location_city: geo?.city || city,
      location_region: geo?.region || null,
      location_country: geo?.country || country,
      location_country_code: geo?.countryCode || null,
      location_radius_miles: geo ? DEFAULT_RADIUS_MILES : null,
      location_country_only: false,
      marital_status: body.maritalStatus || null,
      ancestral_village: body.ancestralRegion || null,
      willing_to_relocate: body.relocation || null,
      relocate: body.relocation || null,
      home_language: (body.languages ?? []).join(", ") || null,
      religious_practice: body.religiousPractice || null,
      appearance:
        genderLabel === "Female"
          ? (body.appearance ?? []).join(", ")
          : (body.appearance ?? [])[0] || null,
      education: body.education || null,
      occupation: body.occupation || body.employment || null,
      has_children: body.hasChildren || null,
      wants_children: body.willingChildren || null,
      about_me: body.about || null,
      partner_preferences: body.lookingFor || null,
      open_to: (body.openTo ?? []).join(", ") || null,
      phone: body.phone || null,
      phone_country_code: body.phoneCountry || null,
      photo_status: photoUrl ? "pending" : null,
      photo_url: photoUrl,
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
