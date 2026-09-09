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
  photoUrl?: string | null;
  matchScore?: number;
  matchReasons?: string[];
  online?: boolean;
  justJoined?: boolean;
  lastSeenLabel?: string;
};

function Detail({ children }: { children: React.ReactNode }) {
  return <p className="detail-line">{children}</p>;
}

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

  const presenceLabel = p.online
    ? "Online"
    : p.justJoined
      ? "Just Joined"
      : p.lastSeenLabel && p.lastSeenLabel !== "Online"
        ? p.lastSeenLabel
        : "Offline";

  return (
    <article className="card p-4 flex flex-col">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="inline-block px-2.5 py-1 rounded-md bg-rose-50 text-rose-600 text-xs font-bold">
              Profile: {code}
            </span>
          </div>

          <p
            className={`mt-2.5 flex items-center gap-1.5 text-xs font-semibold ${
              p.online ? "text-emerald-700" : p.justJoined ? "text-amber-800" : "text-ink-700/65"
            }`}
          >
            <span
              className={`relative inline-flex h-2 w-2 shrink-0 rounded-full ${
                p.online ? "bg-emerald-500" : p.justJoined ? "bg-amber-500" : "bg-rose-400/80"
              }`}
              aria-hidden
            >
              {p.online ? (
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              ) : null}
            </span>
            <span>{presenceLabel}</span>
          </p>

          {p.matchScore != null ? (
            p.matchScore >= 75 ? (
              <p className="mt-1.5 text-[11px] font-bold tracking-wide text-ink-950">
                Strong Compatibility · {p.matchScore}%
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] font-semibold text-ink-700/55">{p.matchScore}% compatible</p>
            )
          ) : null}

          {p.matchReasons && p.matchReasons.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-ink-700/70 leading-snug">
              {p.matchReasons.slice(0, 2).map((reason) => (
                <li key={reason} className="line-clamp-1">
                  · {reason}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 space-y-1.5">
            {p.age != null ? (
              <Detail>
                <IconCalendar />
                {p.age} yrs
              </Detail>
            ) : null}
            {p.height ? (
              <Detail>
                <IconRuler />
                {p.height}
              </Detail>
            ) : null}
            {p.tribe ? (
              <Detail>
                <IconFlag />
                {p.tribe}
              </Detail>
            ) : null}
            {p.country ? (
              <Detail>
                <IconGlobe />
                {p.country}
              </Detail>
            ) : null}
            {p.city ? (
              <Detail>
                <IconPin />
                {p.city}
              </Detail>
            ) : null}
            {p.occupation ? (
              <Detail>
                <IconBriefcase />
                {p.occupation}
              </Detail>
            ) : null}
          </div>
        </div>
        <div className="relative shrink-0 self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              p.photoUrl ||
              `https://i.pravatar.cc/200?img=${(p.avatarSeed % 70) + 1}`
            }
            className="w-[6.75rem] h-[6.75rem] sm:w-28 sm:h-28 rounded-xl object-cover"
            style={{ filter: "blur(10px) saturate(0.8)" }}
            alt="Blurred profile photo"
          />
          <span
            title={presenceLabel}
            className={`absolute top-1.5 right-1.5 h-3 w-3 rounded-full ring-2 ring-white ${
              p.online ? "bg-emerald-500" : p.justJoined ? "bg-amber-500" : "bg-rose-400"
            }`}
            aria-label={presenceLabel}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-700/75 leading-relaxed line-clamp-3 flex-1">{about}</p>
      <div className="mt-4 flex items-center gap-2">
        <a
          href={
            p.profileCode
              ? `/p/${encodeURIComponent(p.profileCode)}${
                  returnQuery ? `?from=${encodeURIComponent(returnQuery)}` : ""
                }`
              : `#profile-${p.id}`
          }
          className="flex-1 text-center py-2 rounded-full border border-ink-900/12 text-sm font-semibold text-ink-900 hover:border-rose-300 transition"
        >
          Full Profile
        </a>
        <button
          type="button"
          onClick={onToggleSave}
          disabled={saveBusy}
          aria-pressed={saved}
          className={`icon-circle transition disabled:opacity-50 ${
            saved ? "bg-rose-50 border-rose-200 text-rose-600" : "text-ink-700/50 hover:text-ink-900"
          }`}
          aria-label={saved ? "Remove from saved" : "Save"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M6 3.5h12v17l-6-4-6 4v-17Z" />
          </svg>
        </button>
      </div>
    </article>
  );
}

function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}
function IconRuler() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <path d="M6 3v18M18 3v18M4 7h4M4 17h4M16 7h4M16 17h4" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <path d="M12 21s-6-5.5-6-10.5A6 6 0 0 1 18 10.5C18 15.5 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
