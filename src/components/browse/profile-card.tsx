import "flag-icons/css/flag-icons.min.css";
import type { ReactNode } from "react";
import { ActivityDot } from "@/components/activity-dot";
import { countryLabel, toCountryCode } from "@/lib/country";
import { tribeLabel } from "@/lib/tribes";

export type ProfileCardData = {
  id: string;
  userId: string;
  profileCode: string | null;
  age: number | null;
  height: string | null;
  tribe: string | null;
  country: string | null;
  city: string | null;
  occupation: string | null;
  education: string | null;
  aboutMe: string | null;
  avatarSeed: number;
  /** Server-side blurred derivative only — never the original photo. */
  photoUrl?: string | null;
  matchScore?: number;
  matchReasons?: string[];
  online?: boolean;
  justJoined?: boolean;
  lastSeenLabel?: string;
  /** Set when the card comes from expanded discovery — says which preference it falls outside. */
  expandedLabel?: string;
  /** Coarse activity bucket (0 = active in the last few minutes) — internal, never displayed. */
  activityBucket?: number;
};

/** "London, UK" — short names for the countries members mostly come from. */
const SHORT_COUNTRY: Record<string, string> = { GB: "UK", US: "USA", AE: "UAE" };

function placeLine(city: string | null, country: string | null) {
  const code = toCountryCode(country);
  const name = code ? SHORT_COUNTRY[code] ?? countryLabel(code) ?? country : country;
  return { code, text: [city, name].filter(Boolean).join(", ") };
}

/** One detail cell: outline icon + value, value wraps gracefully (no truncation). */
function Cell({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 items-start gap-2">
      <span className="mt-[1px] shrink-0">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

/** A row of up to two detail cells with a subtle grey separator between them. */
function DetailRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  if (!left && !right) return null;
  return (
    <div className="flex items-stretch gap-3 text-[14px] leading-snug text-ink-900/85">
      {left}
      {left && right ? <span aria-hidden className="w-px shrink-0 self-stretch bg-ink-900/12" /> : null}
      {right}
    </div>
  );
}

/**
 * Browse card (reference-matched): blurred photo with the activity pill, then "PNM581, 28" as a
 * bold heading, two compact detail rows (place · height / occupation · education) separated by a
 * subtle rule, a soft tribe badge with the bookmark on the far right, and a two-line About preview.
 * The whole card opens the full profile; only the bookmark does something else.
 */
export function ProfileCard({
  p,
  saved = false,
  saveBusy = false,
  onToggleSave,
  returnQuery = "",
}: {
  p: ProfileCardData;
  saved?: boolean;
  saveBusy?: boolean;
  onToggleSave?: () => void;
  /** Current Browse query string ("?country=GB…") so the profile's back link restores filters. */
  returnQuery?: string;
}) {
  const code = p.profileCode || "Member";
  const heading = p.age != null ? `${code}, ${p.age}` : code;
  const about =
    p.aboutMe?.trim() ||
    "This member has not written an about section yet. Open the full profile to learn more.";

  const presenceLabel = p.lastSeenLabel || "Active over a month ago";
  const place = placeLine(p.city, p.country);
  const tribe = tribeLabel(p.tribe);
  const href = p.profileCode
    ? `/p/${encodeURIComponent(p.profileCode)}${returnQuery ? `?from=${encodeURIComponent(returnQuery)}` : ""}`
    : `#profile-${p.id}`;

  const placeCell = place.text ? (
    <Cell
      icon={
        place.code ? (
          <span aria-hidden className={`fi fi-${place.code.toLowerCase()} rounded-[2px] text-[15px] leading-none`} />
        ) : (
          <IconPin />
        )
      }
    >
      {place.text}
    </Cell>
  ) : null;
  const heightCell = p.height ? <Cell icon={<IconHeight />}>{p.height}</Cell> : null;
  const jobCell = p.occupation ? <Cell icon={<IconBriefcase />}>{p.occupation}</Cell> : null;
  const eduCell = p.education ? <Cell icon={<IconCap />}>{p.education}</Cell> : null;

  return (
    <article className="relative card p-3 flex flex-col group shadow-[0_6px_24px_-12px_rgba(17,17,24,0.18)] hover:border-rose-200 transition">
      {/* The whole card opens the profile; the bookmark sits above this link. */}
      <a href={href} className="absolute inset-0 rounded-[inherit] z-0" aria-label={`View ${code}'s profile`} />

      <div className="relative z-[1] pointer-events-none">
        <div className="relative aspect-[5/4] w-full overflow-hidden rounded-xl border border-ink-900/8 bg-ink-900/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.photoUrl || `https://i.pravatar.cc/300?img=${(p.avatarSeed % 70) + 1}`}
            className="h-full w-full object-cover scale-110"
            style={{ filter: "blur(10px) saturate(0.85)" }}
            alt="Blurred profile photo"
          />
          <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur-sm px-2.5 py-1 text-[11.5px] font-medium text-white">
              <ActivityDot label={presenceLabel} />
              {presenceLabel}
            </span>
            {p.justJoined ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11.5px] font-semibold text-rose-600">
                <span aria-hidden>🎉</span>
                Just Joined
              </span>
            ) : null}
          </div>
        </div>

        <div className="px-1 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[21px] font-semibold tracking-tight text-ink-950">{heading}</h3>
            {p.expandedLabel ? (
              <span className="inline-block rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                {p.expandedLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-2.5 space-y-2">
            <DetailRow left={placeCell} right={heightCell} />
            <DetailRow left={jobCell} right={eduCell} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <IconPeople />
              {tribe ? (
                <span className="truncate rounded-full bg-[#f4ead6] px-3 py-1 text-[12.5px] font-semibold text-[#8a6a32]">
                  {tribe}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={onToggleSave}
              disabled={saveBusy}
              aria-pressed={saved}
              className={`pointer-events-auto shrink-0 -mr-1 flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-50 ${
                saved ? "text-rose-600" : "text-ink-900/70 hover:bg-ink-900/5 hover:text-ink-950"
              }`}
              aria-label={saved ? "Remove from saved" : "Save"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                <path d="M6 4h12v16l-6-4-6 4V4Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* About preview: two muted lines that fade out at the end. */}
      <p
        className="relative z-[1] pointer-events-none mt-3 px-1 text-[13px] leading-relaxed text-ink-700/55 line-clamp-2"
        style={{ WebkitMaskImage: "linear-gradient(to bottom, #000 1.25rem, rgba(0,0,0,0.35))" }}
      >
        {about}
      </p>
    </article>
  );
}

const STROKE = "#4b5563";

function IconHeight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16" />
      <path d="m8.5 7.5 3.5-3.5 3.5 3.5" />
      <path d="m8.5 16.5 3.5 3.5 3.5-3.5" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}
function IconCap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" />
      <path d="M7 11.4V15c0 1.2 2.2 2.3 5 2.3s5-1.1 5-2.3v-3.6" />
      <path d="M21 9.5V14" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.6 14.2c2 .2 3.4 1.9 3.4 4.8" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2" />
    </svg>
  );
}
