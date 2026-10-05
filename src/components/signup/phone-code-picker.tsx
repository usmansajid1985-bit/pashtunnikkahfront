"use client";

import { useEffect, useRef, useState } from "react";
import "flag-icons/css/flag-icons.min.css";
import type { PhoneCountryCode } from "@/lib/phone-codes";

function Flag({ iso }: { iso: string }) {
  return <span aria-hidden className={`fi fi-${iso.toLowerCase()} shrink-0 rounded-[3px]`} />;
}

/**
 * Dial-code picker for the signup phone step. The list comes from `/api/phone-codes` (pinned
 * countries first); flags are SVGs so they also show on Windows, where emoji flags don't.
 */
export function PhoneCodePicker({
  iso,
  dialCode,
  onChange,
}: {
  iso: string;
  dialCode: string;
  onChange: (next: { iso: string; dialCode: string }) => void;
}) {
  const [codes, setCodes] = useState<PhoneCountryCode[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/phone-codes")
      .then((r) => (r.ok ? r.json() : { codes: [] }))
      .then((d: { codes?: PhoneCountryCode[] }) => {
        if (!cancelled) setCodes(d.codes ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Drafts saved before the picker stored a country only have the dial code — match on that.
  const selected =
    codes.find((c) => c.iso === iso && c.dialCode === dialCode) ?? codes.find((c) => c.dialCode === dialCode);

  const q = query.trim().toLowerCase();
  const matches = q
    ? codes.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.iso.toLowerCase() === q ||
          c.dialCode.includes(q.replace(/^\+?/, "+")),
      )
    : codes;
  const pinned = matches.filter((c) => c.pinned);
  const others = matches.filter((c) => !c.pinned);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const row = (c: PhoneCountryCode) => {
    const active = c.iso === selected?.iso;
    return (
      <li key={c.iso} role="option" aria-selected={active}>
        <button
          type="button"
          onClick={() => {
            onChange({ iso: c.iso, dialCode: c.dialCode });
            close();
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-rose-50 ${
            active ? "bg-rose-50 font-semibold" : ""
          }`}
        >
          <Flag iso={c.iso} />
          <span className="min-w-0 flex-1 truncate">{c.name}</span>
          <span className="shrink-0 tabular-nums text-ink-700/60">{c.dialCode}</span>
        </button>
      </li>
    );
  };

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${selected ? `${selected.name} ` : ""}${dialCode}`}
        disabled={codes.length === 0}
        onClick={() => (open ? close() : setOpen(true))}
        className="field flex h-full items-center gap-2 whitespace-nowrap"
        style={{ width: "auto" }}
      >
        {selected ? <Flag iso={selected.iso} /> : null}
        <span className="tabular-nums">{dialCode}</span>
        <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 text-ink-700/50">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-lg">
          <div className="border-b border-ink-900/8 p-2">
            <input
              autoFocus
              className="field"
              placeholder="Search country or code"
              aria-label="Search country or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul role="listbox" aria-label="Country code" className="max-h-64 overflow-y-auto py-1">
            {pinned.map(row)}
            {pinned.length && others.length ? (
              <li aria-hidden className="my-1 border-t border-ink-900/8" />
            ) : null}
            {others.map(row)}
            {matches.length === 0 ? (
              <li className="px-3 py-3 text-sm text-ink-700/60">No matching country</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
