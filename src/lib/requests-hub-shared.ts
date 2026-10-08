/** Client-safe types + helpers (no Prisma / Node deps). */
import { toCountryCode } from "@/lib/country";

export type HubCard = {
  id: string;
  requestId?: string;
  peerUserId: string;
  code: string;
  name: string;
  place: string;
  age: number | null;
  maritalStatus: string | null;
  summary: string;
  avatarSeed: number;
  createdAt: string;
  status?: string;
  /** Q06: when the request was sent, and when it reached its current status. */
  requestedAt?: string;
  statusAt?: string;
  /** Pending requests only: when the 7-day window closes. */
  expiresAt?: string | null;
  /** Sent requests: the Match Token came back (withdrawn / expired). */
  tokenRefunded?: boolean;
  compat: number;
  lastMessage?: string | null;
  photoShared?: boolean;
  communicationMode?: string | null;
  note?: string | null;
  introMessage?: string | null;
};

export function formatAgeLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Q06: "Requested on 22 Sep, 14:30" style line for a request/match card (member's local time). */
export function statusDateLabel(card: Pick<HubCard, "status" | "requestedAt" | "statusAt" | "createdAt">) {
  const verb: Record<string, string> = {
    pending: "Requested",
    accepted: "Matched",
    ended: "Ended",
    declined: "Declined",
    cancelled: "Withdrawn",
    expired: "Expired",
  };
  const status = card.status || "pending";
  const iso = status === "pending" ? card.requestedAt || card.createdAt : card.statusAt || card.createdAt;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${verb[status] ?? "Updated"} on ${date}, ${time}`;
}

/** "Expires in 6 days" / "Expires in 5 hours" for a pending request; soon = final 24 hours. */
export function expiryCountdown(expiresAt: string, now = Date.now()): { label: string; soon: boolean; msLeft: number } {
  const msLeft = new Date(expiresAt).getTime() - now;
  if (msLeft <= 0) return { label: "Expiring…", soon: true, msLeft };
  const hours = msLeft / 3_600_000;
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return { label: `Expires in ${days} day${days === 1 ? "" : "s"}`, soon: false, msLeft };
  }
  if (hours >= 1) {
    const h = Math.floor(hours);
    return { label: `Expires in ${h} hour${h === 1 ? "" : "s"}`, soon: true, msLeft };
  }
  const mins = Math.max(1, Math.floor(msLeft / 60_000));
  return { label: `Expires in ${mins} min${mins === 1 ? "" : "s"}`, soon: true, msLeft };
}

/** Lightweight compatibility heuristic for UI (0–99). */
export type CompatProfile = {
  country: string | null;
  city: string | null;
  marital_status: string | null;
  religious_practice: string | null;
  ancestral_village: string | null;
  age: number | null;
  tribe?: string | null;
  education?: string | null;
  religious_methodology?: string | null;
  dialect?: string | null;
  willing_to_relocate?: string | null;
};

export function compatScore(me: CompatProfile | null, peer: CompatProfile | null) {
  if (!me || !peer) return 55;
  let score = 42;
  const same = (a?: string | null, b?: string | null) =>
    Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

  const sameCountry = (a?: string | null, b?: string | null) => {
    const ca = toCountryCode(a);
    const cb = toCountryCode(b);
    return ca && cb ? ca === cb : same(a, b);
  };

  if (sameCountry(me.country, peer.country)) score += 10;
  if (same(me.city, peer.city)) score += 8;
  if (same(me.religious_practice, peer.religious_practice)) score += 12;
  if (same(me.religious_methodology, peer.religious_methodology)) score += 6;
  if (same(me.ancestral_village, peer.ancestral_village)) score += 8;
  if (same(me.tribe, peer.tribe) && (me.tribe ?? "").trim().toLowerCase() !== "unsure") score += 7;
  if (same(me.education, peer.education)) score += 4;
  if (same(me.dialect, peer.dialect)) score += 3;
  if (same(me.willing_to_relocate, peer.willing_to_relocate)) score += 2;
  if (me.marital_status && peer.marital_status) score += 4;
  if (me.age != null && peer.age != null) {
    const diff = Math.abs(me.age - peer.age);
    if (diff <= 3) score += 10;
    else if (diff <= 7) score += 6;
    else if (diff <= 12) score += 3;
  }
  return Math.min(99, Math.max(32, score));
}
