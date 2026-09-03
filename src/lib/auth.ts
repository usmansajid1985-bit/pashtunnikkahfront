import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "pn_session";
const SESSION_DAYS = 14;

export type SessionPayload = {
  userId: string;
  email: string;
  displayName: string;
  profileCode: string | null;
  plan: string | null;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(authSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (!payload.userId || typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      email: String(payload.email ?? ""),
      displayName: String(payload.displayName ?? ""),
      profileCode: (payload.profileCode as string | null) ?? null,
      plan: (payload.plan as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function verifyPassword(plain: string, storedHash: string | null | undefined) {
  const hash = (storedHash ?? "").trim();
  if (!hash) {
    const temp = process.env.MIGRATION_TEMP_PASSWORD ?? "";
    return Boolean(temp) && plain === temp;
  }
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

/** Resolve login by email or profile code (e.g. PNM005). */
export async function findUserForLogin(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;

  const looksLikeEmail = raw.includes("@");
  if (looksLikeEmail) {
    const user = await prisma.users.findFirst({
      where: { email: { equals: raw, mode: "insensitive" } },
      include: { profiles: true },
    });
    return user;
  }

  const profile = await prisma.profiles.findFirst({
    where: { profile_code: { equals: raw, mode: "insensitive" } },
    include: { users: true },
  });
  if (!profile?.users) return null;
  return { ...profile.users, profiles: profile };
}
