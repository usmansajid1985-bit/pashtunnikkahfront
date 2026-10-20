import Link from "next/link";
import { announcementDate, type AnnouncementCard } from "@/lib/announcements-shared";

const EMOJI_TINT: Record<AnnouncementCard["category"], string> = {
  product_update: "bg-rose-50",
  community: "bg-violet-50",
  safety: "bg-blue-50",
  important: "bg-amber-50",
};

/** Emoji in a pastel circle, or the admin's thumbnail image instead. */
export function AnnouncementIcon({ card, size = 56 }: { card: AnnouncementCard; size?: number }) {
  if (card.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.thumbnailUrl}
        alt=""
        loading="lazy"
        className="shrink-0 rounded-full object-cover bg-ink-900/5"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`shrink-0 rounded-full flex items-center justify-center ${EMOJI_TINT[card.category]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.48) }}
    >
      {card.emoji}
    </span>
  );
}

/**
 * One announcement in Notifications → Announcements (and under each full page). Unread ones carry
 * a pink "New" pill and a tinted edge; the whole card opens the announcement's own URL.
 */
export function AnnouncementCardRow({ card, from = "list" }: { card: AnnouncementCard; from?: "list" | "page" }) {
  return (
    <Link
      href={`/announcements/${encodeURIComponent(card.slug)}`}
      data-from={from}
      className={`group flex items-center gap-3.5 rounded-2xl border bg-white px-3.5 py-3.5 sm:px-4 transition hover:shadow-[0_8px_24px_-16px_rgba(15,13,14,0.35)] ${
        card.read ? "border-ink-900/6" : "border-rose-200 bg-rose-50/30"
      }`}
    >
      <AnnouncementIcon card={card} />
      <span className="min-w-0 flex-1">
        {!card.read ? (
          <span className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
              New
            </span>
            <span className="text-[12px] text-ink-700/50 shrink-0">{announcementDate(card.publishedAt)}</span>
          </span>
        ) : null}
        <span className={`block text-[15px] font-bold text-ink-950 leading-snug ${card.read ? "" : "mt-1"}`}>
          {card.title}
        </span>
        {card.read ? (
          <span className="block text-[12.5px] text-ink-700/50 mt-0.5">{announcementDate(card.publishedAt)}</span>
        ) : null}
        {card.summary ? (
          <span className="text-[13px] text-ink-700/70 mt-0.5 line-clamp-2">{card.summary}</span>
        ) : null}
      </span>
      <svg className="shrink-0 text-ink-700/35 group-hover:text-ink-700/60" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}
