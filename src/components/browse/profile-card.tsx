import "flag-icons/css/flag-icons.min.css";
import { countryLabel, toCountryCode } from "@/lib/country";
import { TribePill } from "@/components/tribe/tribe-pill";
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

function Detail({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[13.5px] text-ink-900/80 min-w-0">
      <span className="shrink-0 w-[18px] flex justify-center">{icon}</span>
      <span className="min-w-0 truncate flex items-center gap-2">{children}</span>
    </p>
  );
}

/**
 * Browse card: blurred photo across the top (activity + Just Joined pills on it), then the
 * profile ID, age, height, flag + place, tribe and profession, a short about, and the bookmark.
 * The whole card opens the full profile; only the bookmark does something else. No compatibility
 * on Browse cards.
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
  const about =
    p.aboutMe?.trim() ||
    "This member has not written an about section yet. Open the full profile to learn more.";

  // B13/B14: simple activity wording only; Just Joined is its own badge, never a replacement.
  const presenceLabel = p.lastSeenLabel || "Active over a month ago";
  const place = placeLine(p.city, p.country);
  const href = p.profileCode
    ? `/p/${encodeURIComponent(p.profileCode)}${returnQuery ? `?from=${encodeURIComponent(returnQuery)}` : ""}`
    : `#profile-${p.id}`;

  return (
    <article className="relative card p-3 flex flex-col group hover:border-rose-200 transition">
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
              <span
                className="h-2 w-2 rounded-full bg-emerald-400"
                aria-hidden
              />
              {presenceLabel}
            </span>
            {p.justJoined ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11.5px] font-semibold text-rose-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l2.2 6.6H21l-5.5 4 2.1 6.6L12 15.2 6.4 19.2l2.1-6.6L3 8.6h6.8Z" />
                </svg>
                Just Joined
              </span>
            ) : null}
          </div>
        </div>

        <div className="px-1 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[17px] font-bold text-rose-600">{code}</p>
            {p.expandedLabel ? (
              <span className="inline-block px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 text-[11px] font-semibold">
                {p.expandedLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-2.5 space-y-2">
            {p.age != null ? <Detail icon={<IconCalendar />}>{p.age} years</Detail> : null}
            {p.height ? <Detail icon={<IconRuler />}>{p.height}</Detail> : null}
            {place.text ? (
              <Detail icon={<IconPin />}>
                {place.code ? (
                  <span aria-hidden className={`fi fi-${place.code.toLowerCase()} shrink-0 rounded-[2px]`} />
                ) : null}
                <span className="truncate">{place.text}</span>
              </Detail>
            ) : null}
            {tribeLabel(p.tribe) ? (
              <Detail icon={<IconFamily />}>
                <TribePill tribe={p.tribe} className="px-2.5 py-0.5 text-[12px]" />
              </Detail>
            ) : null}
            {p.occupation ? <Detail icon={<IconBriefcase />}>{p.occupation}</Detail> : null}
          </div>
        </div>
      </div>

      <div className="relative z-[1] pointer-events-none mt-3 mx-1 pt-3 border-t border-ink-900/8 flex items-end gap-3 flex-1">
        <p className="flex-1 text-[12.5px] text-ink-700/75 leading-relaxed line-clamp-4">{about}</p>
        <button
          type="button"
          onClick={onToggleSave}
          disabled={saveBusy}
          aria-pressed={saved}
          className={`pointer-events-auto shrink-0 -mr-1 -mb-1 w-9 h-9 flex items-center justify-center rounded-full transition disabled:opacity-50 ${
            saved ? "text-rose-600" : "text-ink-900/70 hover:text-ink-950 hover:bg-ink-900/5"
          }`}
          aria-label={saved ? "Remove from saved" : "Save"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M6 3.5h12v17l-6-4-6 4v-17Z" />
          </svg>
        </button>
      </div>
    </article>
  );
}

function IconCalendar() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}
function IconRuler() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <path d="M6 3v18M18 3v18M4 7h4M4 17h4M16 7h4M16 17h4" />
    </svg>
  );
}
function IconFamily() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14.3c.5-.2 1-.3 1.5-.3 2.2 0 4 1.5 4 4" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
