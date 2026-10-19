"use client";

import "flag-icons/css/flag-icons.min.css";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { HubCard } from "@/lib/requests-hub-shared";
import { expiryCountdown, relativeStamp, statusDateLabel } from "@/lib/requests-hub-shared";
import { useRequestActions } from "@/components/matches/request-actions";
import { RematchButton } from "@/components/matches/rematch-button";

/** Where the introduction message opens: Chats → Requests → Received, with this request open. */
export function requestChatHref(card: Pick<HubCard, "requestId">, sub: "received" | "sent" = "received") {
  return `/chats?tab=requests&sub=${sub}&request=${card.requestId}`;
}

/** Rendered after mount so the time is in the member's own timezone (no hydration mismatch). */
export function LocalTime({ iso, prefix }: { iso: string; prefix: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => setLabel(`${prefix ? `${prefix} ` : ""}${relativeStamp(iso)}`), [iso, prefix]);
  return <span suppressHydrationWarning>{label}</span>;
}

function StatusLine({ card }: { card: HubCard }) {
  const [label, setLabel] = useState("");
  useEffect(() => setLabel(statusDateLabel(card)), [card]);
  return <span suppressHydrationWarning>{label}</span>;
}

/** Remaining time on a pending request; reloads the list when it runs out so it leaves on its own. */
function ExpiryNote({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const [state, setState] = useState<ReturnType<typeof expiryCountdown> | null>(null);
  useEffect(() => {
    let refreshed = false;
    const tick = () => {
      const next = expiryCountdown(expiresAt);
      setState(next);
      if (next.msLeft <= 0 && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [expiresAt, router]);
  if (!state) return null;
  return <span className={state.soon ? "text-amber-700" : "text-ink-700/50"}>{state.label}</span>;
}

/** The member's server-blurred photo (never the original), or a neutral placeholder. */
export function RequestPhoto({ card, className = "" }: { card: HubCard; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!card.photoUrl || failed) {
    return (
      <div className={`shrink-0 rounded-2xl bg-gradient-to-br from-ink-900/10 to-ink-900/5 flex items-center justify-center text-ink-700/30 ${className}`}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0Z" />
        </svg>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={card.photoUrl}
      alt=""
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-2xl object-cover bg-ink-900/5 ${className}`}
    />
  );
}

export function NameAge({ card, className = "" }: { card: HubCard; className?: string }) {
  return (
    <p className={`font-bold text-ink-950 truncate ${className}`}>
      {card.code}
      {card.age ? <span className="font-medium">, {card.age}</span> : null}
    </p>
  );
}

export function PlaceLine({ card }: { card: HubCard }) {
  if (!card.place) return null;
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-700/65 min-w-0">
      {card.countryCode ? (
        <span aria-hidden className={`fi fi-${card.countryCode.toLowerCase()} shrink-0 rounded-[2px]`} />
      ) : null}
      <span className="truncate">{card.place}</span>
    </p>
  );
}

export function TimeLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-700/65">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

const PILL: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Matched", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ended: { label: "Ended", className: "bg-ink-900/5 text-ink-700/70 border-ink-900/10" },
  declined: { label: "Declined", className: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled: { label: "Withdrawn", className: "bg-ink-900/5 text-ink-700/70 border-ink-900/10" },
  expired: { label: "Expired", className: "bg-ink-900/5 text-ink-700/70 border-ink-900/10" },
};

export function StatusPill({ status }: { status?: string }) {
  const pill = PILL[status || "pending"];
  if (!pill) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11.5px] sm:text-[12px] font-semibold ${pill.className}`}>
      {pill.label}
    </span>
  );
}

type MenuItem = { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean };

/** ⋮ button with a small popover menu; closes on outside click / Escape. */
export function KebabMenu({ items, label = "More options" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div ref={ref} className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`w-8 h-8 -mr-1 flex items-center justify-center rounded-full text-ink-700/60 hover:bg-ink-900/5 ${open ? "bg-ink-900/5" : ""}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-9 z-30 min-w-48 rounded-xl bg-white border border-ink-900/8 shadow-[0_12px_32px_-12px_rgba(15,13,14,0.35)] py-1">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[14px] hover:bg-ink-900/[0.04] disabled:opacity-50 ${
                it.danger ? "text-ink-950" : "text-ink-900"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const MinusCircleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </svg>
);

const BlockIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </svg>
);

const UserIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-700/60" aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

/** Card shell: tapping anywhere that isn't a control opens the member's profile. */
function CardShell({ card, children }: { card: HubCard; children: ReactNode }) {
  return (
    <article className="relative bg-white rounded-2xl border border-ink-900/6 shadow-[0_1px_3px_rgba(15,13,14,0.04)] p-3.5 sm:p-4 hover:border-ink-900/12 transition">
      <Link href={`/p/${card.code}`} className="absolute inset-0 rounded-2xl" aria-label={`View ${card.code}'s profile`} />
      <div className="relative pointer-events-none">{children}</div>
    </article>
  );
}

/** Decline / Accept, with Block in the ⋮ menu (Q-flow: block without accepting first). */
export function ReceivedCard({ card }: { card: HubCard }) {
  const router = useRouter();
  const { act, block, pending, error } = useRequestActions(card.requestId!);
  const [confirmBlock, setConfirmBlock] = useState(false);

  return (
    <CardShell card={card}>
      <div className="flex gap-3.5 sm:gap-5">
        <RequestPhoto card={card} className="w-20 h-20 sm:w-28 sm:h-28" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <NameAge card={card} className="text-[17px] sm:text-lg pt-0.5" />
            <KebabMenu
              items={[
                { label: "View profile", icon: UserIcon, onClick: () => router.push(`/p/${card.code}`) },
                { label: "Block member", icon: BlockIcon, onClick: () => setConfirmBlock(true), danger: true },
              ]}
            />
          </div>
          <PlaceLine card={card} />
          <TimeLine>
            <LocalTime iso={card.requestedAt || card.createdAt} prefix="Received" />
          </TimeLine>
          {card.expiresAt ? (
            <p className="mt-0.5 pl-[21px] text-[12px]">
              <ExpiryNote expiresAt={card.expiresAt} />
            </p>
          ) : null}
        </div>
      </div>

      <div className="sm:pl-[132px]">
        {card.introMessage ? (
          <Link
            href={requestChatHref(card)}
            className="pointer-events-auto mt-3 flex items-center gap-3 rounded-xl bg-rose-50/80 border border-rose-100 px-3.5 py-3 hover:bg-rose-50 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 self-start mt-0.5" aria-hidden>
              <path d="M4 5h16v11H9l-5 4Z" />
              <path d="M8 9.5h8M8 12.5h5" />
            </svg>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-rose-600">{card.code}&apos;s introduction message</span>
              <span className="text-[13px] text-ink-700/80 line-clamp-2">{card.introMessage}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-700/40" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        ) : null}

        {confirmBlock ? (
          <div className="pointer-events-auto mt-3 flex flex-wrap items-center justify-end gap-2 text-[13px]">
            <span className="text-ink-700/70 mr-auto">Block {card.code}? They won&apos;t be able to contact you.</span>
            <button type="button" onClick={() => setConfirmBlock(false)} className="px-3 py-1.5 rounded-full font-semibold text-ink-700/70 hover:bg-ink-900/5">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => block(card.peerUserId)}
              className="px-3.5 py-1.5 rounded-full bg-rose-600 text-white font-semibold disabled:opacity-50"
            >
              Block
            </button>
          </div>
        ) : (
          <div className="pointer-events-auto mt-3 flex gap-2.5 sm:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => act("decline")}
              className="flex-1 sm:flex-none sm:min-w-36 px-6 py-2.5 rounded-full border border-rose-400 bg-white text-rose-600 text-[14px] font-semibold hover:bg-rose-50 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act("accept")}
              className="flex-1 sm:flex-none sm:min-w-36 px-6 py-2.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-[14px] font-semibold hover:bg-emerald-100 disabled:opacity-50"
            >
              Accept
            </button>
          </div>
        )}
        {error ? <p className="mt-2 text-xs text-rose-700 text-right">{error}</p> : null}
      </div>
    </CardShell>
  );
}

/** Status pill + sent time; a pending request can be withdrawn from the ⋮ menu. */
export function SentCard({ card }: { card: HubCard }) {
  const router = useRouter();
  const { act, pending, error } = useRequestActions(card.requestId!);
  const isPending = (card.status || "pending") === "pending";

  return (
    <CardShell card={card}>
      <div className="flex gap-3.5 sm:gap-5">
        <RequestPhoto card={card} className="w-20 h-20 sm:w-28 sm:h-28" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <NameAge card={card} className="text-[17px] sm:text-lg pt-0.5" />
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <span className="pointer-events-auto">
                <StatusPill status={card.status} />
              </span>
              <KebabMenu
                items={
                  isPending
                    ? [{ label: "Withdraw request", icon: MinusCircleIcon, onClick: () => act("withdraw"), disabled: pending }]
                    : [{ label: "View profile", icon: UserIcon, onClick: () => router.push(`/p/${card.code}`) }]
                }
              />
            </div>
          </div>
          <PlaceLine card={card} />
          <TimeLine>
            <LocalTime iso={card.requestedAt || card.createdAt} prefix="Sent" />
          </TimeLine>
          {isPending && card.expiresAt ? (
            <p className="mt-0.5 pl-[21px] text-[12px]">
              <ExpiryNote expiresAt={card.expiresAt} />
            </p>
          ) : !isPending ? (
            <p className="mt-0.5 pl-[21px] text-[12px] text-ink-700/50 flex flex-wrap gap-x-2">
              <StatusLine card={card} />
              {card.tokenRefunded ? <span className="font-semibold text-emerald-700">1 Match Token refunded</span> : null}
            </p>
          ) : null}
          {card.status === "accepted" ? (
            <Link
              href={`/chats/${card.requestId}`}
              className="pointer-events-auto mt-2.5 inline-flex px-4 py-1.5 rounded-full bg-rose-600 text-white text-[13px] font-semibold"
            >
              Open chat
            </Link>
          ) : null}
          {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
        </div>
      </div>
    </CardShell>
  );
}

export function MatchedCard({ card }: { card: HubCard }) {
  return (
    <CardShell card={card}>
      <div className="flex gap-3.5 sm:gap-5">
        <RequestPhoto card={card} className="w-20 h-20 sm:w-28 sm:h-28" />
        <div className="min-w-0 flex-1">
          <NameAge card={card} className="text-[17px] sm:text-lg pt-0.5" />
          <PlaceLine card={card} />
          <TimeLine>
            <LocalTime iso={card.statusAt || card.createdAt} prefix="Matched" />
          </TimeLine>
          {card.lastMessage ? (
            <p className="mt-1.5 text-[13px] text-ink-700 line-clamp-1">“{card.lastMessage}”</p>
          ) : null}
          <div className="pointer-events-auto mt-3 flex gap-2">
            <Link href={`/chats/${card.requestId}`} className="px-4 py-1.5 rounded-full bg-rose-600 text-white text-[13px] font-semibold">
              Open chat
            </Link>
            <Link href={`/p/${card.code}`} className="px-4 py-1.5 rounded-full border border-ink-900/12 text-[13px] font-semibold bg-white">
              Profile
            </Link>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

export function PastMatchRow({ card }: { card: HubCard }) {
  return (
    <article className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white/80 border border-ink-900/6 rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <RequestPhoto card={card} className="w-11 h-11 !rounded-full opacity-80" />
        <div className="min-w-0">
          <p className="font-semibold text-ink-950 truncate">{card.code}</p>
          <p className="text-[13px] text-ink-700/55 truncate">
            <StatusLine card={card} />
            {card.lastMessage ? ` · ${card.lastMessage.slice(0, 48)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {card.requestId ? (
          <Link href={`/chats/${card.requestId}`} className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold">
            View chat
          </Link>
        ) : null}
        <Link href={`/p/${card.code}`} className="px-3 py-1.5 rounded-full border border-ink-900/12 text-sm font-semibold">
          Profile
        </Link>
        <RematchButton profileCode={card.code} />
      </div>
    </article>
  );
}

export { StatusLine };
