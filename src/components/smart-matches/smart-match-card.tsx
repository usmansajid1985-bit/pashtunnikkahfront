import type { SmartMatchItem } from "@/lib/smart-matches";

export function SmartMatchCard({ item }: { item: SmartMatchItem }) {
  const code = item.profileCode || "Member";
  const about =
    item.aboutMe?.trim() ||
    "Open the full profile to learn more about this member.";

  return (
    <article className="card p-4 flex flex-col h-full">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <span className="inline-block px-2.5 py-1 rounded-md bg-rose-50 text-rose-600 text-xs font-bold">
            Profile: {code}
          </span>

          <p className="mt-2 text-lg font-bold text-ink-950">{item.score}% match</p>
          {item.score >= 75 ? (
            <p className="text-[11px] font-bold tracking-wide text-ink-950">Strong Compatibility</p>
          ) : null}

          {item.reasons.length > 0 ? (
            <ul className="mt-2.5 space-y-1 text-xs text-ink-700/80 leading-relaxed">
              {item.reasons.map((reason) => (
                <li key={reason} className="flex gap-1.5">
                  <span className="text-rose-500 shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-ink-700/50 italic">
              AI explanation loading on next visit…
            </p>
          )}

          <div className="mt-3 space-y-1 text-xs text-ink-700/75">
            {item.age != null ? <p>{item.age} yrs</p> : null}
            {[item.city, item.country].filter(Boolean).length ? (
              <p>{[item.city, item.country].filter(Boolean).join(", ")}</p>
            ) : null}
            {item.occupation ? <p>{item.occupation}</p> : null}
          </div>
        </div>

        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              item.photoUrl ||
              `https://i.pravatar.cc/200?img=${(item.avatarSeed % 70) + 1}`
            }
            className="w-24 h-24 rounded-xl object-cover"
            style={{ filter: "blur(10px) saturate(0.8)" }}
            alt="Blurred profile photo"
          />
          <span
            className={`absolute top-1.5 right-1.5 h-3 w-3 rounded-full ring-2 ring-white ${
              item.online ? "bg-emerald-500" : "bg-rose-400"
            }`}
            aria-hidden
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-700/75 leading-relaxed line-clamp-2 flex-1">{about}</p>

      <a
        href={item.profileCode ? `/p/${encodeURIComponent(item.profileCode)}` : "#"}
        className="mt-4 block text-center py-2 rounded-full border border-ink-900/12 text-sm font-semibold text-ink-900 hover:border-rose-300 transition"
      >
        View profile
      </a>
    </article>
  );
}
