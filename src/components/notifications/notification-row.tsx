"use client";

import { useRouter } from "next/navigation";
import type { GroupedRow, RowBadge } from "@/lib/notification-groups";
import { useRequestActions } from "@/components/matches/request-actions";

function pravatar(seed: number) {
  return `https://i.pravatar.cc/120?img=${(seed % 70) + 1}`;
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days`;
  const w = Math.floor(d / 7);
  return `${w} wk`;
}

/* ---- avatar badge glyphs (20px circle, 2px white ring) ---- */

const BADGE_BG: Record<NonNullable<RowBadge>, string> = {
  request: "#C8235F",
  match: "#C8235F",
  view: "#776C71",
  photo: "#7C3AED",
  wali: "#C8235F",
  token: "#1F6A47",
};

function BadgeGlyph({ badge }: { badge: RowBadge }) {
  if (!badge) return null;
  return (
    <span
      className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white"
      style={{ background: BADGE_BG[badge] }}
    >
      {badge === "request" || badge === "match" || badge === "wali" ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff">
          <path d="M12 21s-7-4.35-9-8.5C1.4 9 3 5.5 6.5 5.5c2 0 3.7 1.2 5.5 3.3 1.8-2.1 3.5-3.3 5.5-3.3 3.5 0 5.1 3.5 3.5 7C19 16.65 12 21 12 21Z" />
        </svg>
      ) : badge === "view" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : badge === "photo" ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
    </span>
  );
}

function Avatar({ row }: { row: GroupedRow }) {
  const faces = row.actors.slice(0, 2);
  if (faces.length >= 2) {
    // Two overlapping 31px faces inside a 44px box — the text column stays aligned.
    return (
      <div className="relative h-11 w-11 shrink-0">
        {faces.map((a, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={a.thumbnailUrl || pravatar(a.avatarSeed)}
            alt=""
            className={`absolute h-[31px] w-[31px] rounded-full object-cover ring-2 ring-white ${
              i === 0 ? "left-0 top-0" : "bottom-0 right-0"
            }`}
            style={{ filter: "blur(6px) saturate(0.85)" }}
          />
        ))}
        <BadgeGlyph badge={row.badge} />
      </div>
    );
  }
  const a = faces[0];
  return (
    <div className="relative h-11 w-11 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={a?.thumbnailUrl || pravatar(a?.avatarSeed ?? 1)}
        alt=""
        className="h-11 w-11 rounded-full object-cover"
        style={{ filter: "blur(7px) saturate(0.8)" }}
      />
      <BadgeGlyph badge={row.badge} />
    </div>
  );
}

function Pill({ pill }: { pill: NonNullable<GroupedRow["pill"]> }) {
  const styles =
    pill.tone === "amber"
      ? { color: "#7E4A06", background: "#FCF1DE" }
      : pill.tone === "green"
        ? { color: "#1F6A47", background: "#E6F3EC" }
        : { color: "#5E5459", background: "rgba(32,26,29,0.06)" };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold" style={styles}>
      {pill.text}
    </span>
  );
}

function Dot({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "#C8235F" }} />;
}

function Title({ row }: { row: GroupedRow }) {
  return (
    <p className="text-[15px] leading-snug" style={{ color: "#201A1D" }}>
      {row.title}
    </p>
  );
}

/* ---- the one row component, four variants ---- */

export function NotificationRow({ row, onRead }: { row: GroupedRow; onRead: (ids: string[]) => void }) {
  const router = useRouter();
  const requestId = row.action?.kind === "request" ? row.action.requestId : "";
  const { act, pending } = useRequestActions(requestId, {
    onDone: () => onRead(row.ids),
  });

  function open() {
    onRead(row.ids);
    if (row.url) router.push(row.url);
  }

  /* Milestone — wali involved */
  if (row.variant === "milestone") {
    return (
      <div
        className="rounded-[18px] border p-4 sm:p-5"
        style={{ background: "#FFF8FA", borderColor: "#F1D0DD" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ background: "#FCEFF4" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9E1A4A" strokeWidth="1.8">
              <path d="M12 21s-7-4.35-9-8.5C1.4 9 3 5.5 6.5 5.5c2 0 3.7 1.2 5.5 3.3 1.8-2.1 3.5-3.3 5.5-3.3 3.5 0 5.1 3.5 3.5 7C19 16.65 12 21 12 21Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9E1A4A" }}>
              Family involved
            </p>
            <p className="mt-0.5 text-[15px] font-semibold" style={{ color: "#201A1D" }}>
              {row.title}
            </p>
            {row.body ? (
              <p className="mt-0.5 text-[13px]" style={{ color: "#5E5459" }}>
                {row.body}
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={open}
                className="h-10 rounded-full px-4 text-[13px] font-semibold text-white"
                style={{ background: "#C8235F" }}
              >
                Open chat
              </button>
              <span className="text-[12px]" style={{ color: "#776C71" }}>
                {timeAgo(row.latest)}
              </span>
            </div>
          </div>
          <Dot show={row.unread} />
        </div>
      </div>
    );
  }

  /* Action — pending request / open photo share / ended pause */
  const isActionRequest = row.action?.kind === "request" && row.action.status === "pending";
  const isActionPhoto = row.action?.kind === "photo" && row.action.state === "available";
  const isActionPause = row.action?.kind === "pause" && row.action.ended;

  const buttons = isActionRequest ? (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => act("decline")}
        className="h-10 flex-1 rounded-full border text-[13px] font-semibold disabled:opacity-50"
        style={{ borderColor: "rgba(32,26,29,0.12)", color: "#5E5459" }}
      >
        Decline
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => act("accept")}
        className="h-10 flex-1 rounded-full text-[13px] font-semibold text-white disabled:opacity-50"
        style={{ background: "#C8235F" }}
      >
        Accept
      </button>
    </div>
  ) : isActionPhoto ? (
    <button
      type="button"
      onClick={open}
      className="h-10 rounded-full px-4 text-[13px] font-semibold text-white"
      style={{ background: "#C8235F" }}
    >
      View photos
    </button>
  ) : isActionPause ? (
    <button
      type="button"
      onClick={() => {
        onRead(row.ids);
        router.push(row.action?.kind === "pause" ? row.action.chatUrl : row.url ?? "/requests");
      }}
      className="h-10 rounded-full px-4 text-[13px] font-semibold text-white"
      style={{ background: "#C8235F" }}
    >
      Ask again
    </button>
  ) : null;

  if (buttons) {
    return (
      <div className="flex items-start gap-3 px-5 py-4">
        <Avatar row={row} />
        <div className="min-w-0 flex-1">
          <Title row={row} />
          {row.body ? (
            <p className="mt-0.5 text-[13px]" style={{ color: "#5E5459" }}>
              {row.body}
            </p>
          ) : null}
          <p className="mt-1 text-[12px]" style={{ color: "#776C71" }}>
            {timeAgo(row.latest)}
          </p>
          {/* Buttons line up under the text on mobile (ml-14 via this column), full-width-ish. */}
          <div className="mt-3 max-w-sm">{buttons}</div>
        </div>
        <Dot show={row.unread} />
      </div>
    );
  }

  /* Standard */
  return (
    <button type="button" onClick={open} className="flex w-full items-start gap-3 px-5 py-4 text-left">
      <Avatar row={row} />
      <div className="min-w-0 flex-1">
        <Title row={row} />
        {row.body ? (
          <p className="mt-0.5 text-[13px]" style={{ color: "#5E5459" }}>
            {row.body}
          </p>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[12px]" style={{ color: "#776C71" }}>
            {timeAgo(row.latest)}
          </span>
          {row.pill ? <Pill pill={row.pill} /> : null}
          {row.upgradeCta ? (
            <span className="text-[12px] font-semibold" style={{ color: "#C8235F" }}>
              Upgrade to Gold →
            </span>
          ) : null}
        </div>
      </div>
      <Dot show={row.unread} />
    </button>
  );
}
