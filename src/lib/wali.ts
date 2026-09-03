import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const WALI_COOKIE = "pn_wali";
const WALI_SESSION_DAYS = 30;
const MAX_ACTIVE_LINKS = 5;

export type WaliSessionPayload = {
  linkId: string;
  profileUserId: string;
  profileId: string;
  name: string;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function generateWaliToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function createWaliSessionToken(payload: WaliSessionPayload) {
  return new SignJWT({ ...payload, type: "wali" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${WALI_SESSION_DAYS}d`)
    .sign(authSecret());
}

export async function verifyWaliSessionToken(token: string): Promise<WaliSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (payload.type !== "wali" || typeof payload.linkId !== "string") return null;
    return {
      linkId: payload.linkId,
      profileUserId: String(payload.profileUserId ?? ""),
      profileId: String(payload.profileId ?? ""),
      name: String(payload.name ?? "Wali"),
    };
  } catch {
    return null;
  }
}

export function waliCookieOptions(maxAgeSeconds = WALI_SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Reads + validates the wali session cookie against the live DB row (so a revoke takes effect immediately). */
export async function getWaliSession(): Promise<WaliSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(WALI_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyWaliSessionToken(token);
  if (!session) return null;
  const link = await prisma.wali_links.findUnique({ where: { id: BigInt(session.linkId) } });
  if (!link || link.revoked_at || link.user_id.toString() !== session.profileUserId) return null;
  return session;
}

export async function isFemaleProfile(userId: bigint) {
  const profile = await prisma.profiles.findUnique({
    where: { user_id: userId },
    select: { gender: true },
  });
  return Boolean(profile) && (profile!.gender || "").toLowerCase().startsWith("f");
}

export async function listWaliLinks(userId: bigint) {
  return prisma.wali_links.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });
}

export async function activeWaliLinkCount(userId: bigint) {
  return prisma.wali_links.count({ where: { user_id: userId, revoked_at: null } });
}

export { MAX_ACTIVE_LINKS };
