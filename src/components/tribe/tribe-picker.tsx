"use client";

import { useId, useState } from "react";
import { CONFEDERACIES, NEUTRAL_TRIBE_TONE, UNSURE_TRIBE, findTribe, matchTribe } from "@/lib/tribes";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

/**
 * The Confederacy → Tribe selector shared by signup, Edit Profile, the tribe confirmation and the
 * Browse filter: a search box, one coloured bar per confederacy that expands to its tribes, and
 * "Unsure" as a direct choice. `multiple` (filters) lets several tribes be picked.
 */
export function TribePicker({
  selected,
  onChange,
  multiple = false,
}: {
  /** Standard tribe names. Single-select uses the first entry. */
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => findTribe(selected[0])?.confederacy?.id ?? null);

  const q = query.trim().toLowerCase();
  // Typing a known spelling ("Yousafzai") finds the listed tribe too.
  const matched = q ? matchTribe(q) : null;
  const groups = CONFEDERACIES.map((c) => ({
    ...c,
    shown: !q
      ? c.tribes
      : c.label.toLowerCase().includes(q)
        ? c.tribes
        : c.tribes.filter((t) => t.toLowerCase().includes(q) || t === matched),
  })).filter((c) => c.shown.length > 0);

  function toggle(name: string) {
    if (!multiple) return onChange([name]);
    onChange(selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name]);
  }

  const unsureOn = selected.includes(UNSURE_TRIBE);

  return (
    <div className="space-y-2">
      <label htmlFor={searchId} className="sr-only">
        Search tribe
      </label>
      <div className="relative">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/50"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tribe..."
          autoComplete="off"
          className="w-full rounded-xl border border-[#ece7e6] bg-white py-2.5 pl-10 pr-3.5 text-sm focus:border-rose-300 focus:outline-none focus:ring-3 focus:ring-rose-600/10"
        />
      </div>

      {groups.map((c) => {
        const open = q ? true : openId === c.id;
        const picked = c.tribes.filter((t) => selected.includes(t)).length;
        return (
          <div key={c.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : c.id)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] font-semibold ${
                open ? "rounded-t-xl" : "rounded-xl"
              }`}
              style={{ backgroundColor: c.tone.bg, color: c.tone.text }}
            >
              <span className="flex items-center gap-2">
                {c.label}
                {picked > 0 ? (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
                    style={{ backgroundColor: c.tone.text }}
                  >
                    {multiple ? picked : <Check />}
                  </span>
                ) : null}
              </span>
              <Chevron open={open} />
            </button>
            {open ? (
              <div
                role={multiple ? "group" : "radiogroup"}
                aria-label={`${c.label} tribes`}
                className="flex flex-wrap gap-2 rounded-b-xl border border-t-0 bg-white p-3"
                style={{ borderColor: c.tone.border }}
              >
                {c.shown.map((t) => {
                  const on = selected.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      role={multiple ? "checkbox" : "radio"}
                      aria-checked={on}
                      onClick={() => toggle(t)}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition"
                      style={
                        on
                          ? { backgroundColor: c.tone.text, borderColor: c.tone.text, color: "#fff" }
                          : { backgroundColor: c.tone.bg, borderColor: c.tone.border, color: c.tone.text }
                      }
                    >
                      {on ? <Check /> : null}
                      {t}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {q && groups.length === 0 ? (
        <p className="rounded-xl bg-[#faf8f7] px-4 py-3 text-sm text-ink-700/70">
          No tribe matches “{query.trim()}”. Try another spelling, or choose Unsure.
        </p>
      ) : null}

      <button
        type="button"
        role={multiple ? "checkbox" : "radio"}
        aria-checked={unsureOn}
        onClick={() => toggle(UNSURE_TRIBE)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[15px] font-semibold"
        style={
          unsureOn
            ? { backgroundColor: NEUTRAL_TRIBE_TONE.bg, borderColor: NEUTRAL_TRIBE_TONE.text, color: NEUTRAL_TRIBE_TONE.text }
            : { backgroundColor: "#fff", borderColor: NEUTRAL_TRIBE_TONE.border, color: NEUTRAL_TRIBE_TONE.text }
        }
      >
        {UNSURE_TRIBE}
        {unsureOn ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ backgroundColor: NEUTRAL_TRIBE_TONE.text }}>
            <Check />
          </span>
        ) : null}
      </button>
    </div>
  );
}
