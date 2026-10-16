"use client";

import { useEffect, useId, useRef, useState } from "react";
import { careerOptions } from "@/lib/professions";

/**
 * Searchable dropdown for "What do you do?" / "What are you studying?" — members pick from the
 * list (no free text). An older typed-in value is shown until they choose one.
 */
export function CareerPicker({
  employment,
  value,
  onChange,
  className,
}: {
  employment: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const groups = careerOptions(employment);
  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, options: g.options.filter((o) => !q || o.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)) }))
    .filter((g) => g.options.length > 0);
  const listed = groups.some((g) => g.options.includes(value));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function pick(o: string) {
    onChange(o);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`${className} flex items-center justify-between gap-3 text-left`}
      >
        <span className={`truncate ${value ? "text-ink-950" : "text-ink-700/50"}`}>
          {value || (employment === "Student" ? "Select what you're studying" : "Select your profession")}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {value && !listed ? (
        <p className="mt-1 text-xs text-amber-700">Please choose from the list to update this.</p>
      ) : null}
      {open ? (
        <div className="absolute z-30 mt-1.5 w-full rounded-2xl border border-ink-900/10 bg-white shadow-xl">
          <div className="p-2 border-b border-ink-900/8">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = shown[0]?.options[0];
                  if (first) pick(first);
                }
              }}
              placeholder="Search..."
              aria-label="Search"
              className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3 py-2 text-sm focus:outline-none focus:border-rose-300 focus:bg-white"
            />
          </div>
          <div id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {shown.map((g) => (
              <div key={g.group} role="group" aria-label={g.group}>
                {groups.length > 1 ? (
                  <p className="px-3.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-700/50">{g.group}</p>
                ) : null}
                {g.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="option"
                    aria-selected={o === value}
                    onClick={() => pick(o)}
                    className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-rose-50 ${
                      o === value ? "font-semibold text-rose-700" : "text-ink-900"
                    }`}
                  >
                    {o}
                    {o === value ? <span aria-hidden>✓</span> : null}
                  </button>
                ))}
              </div>
            ))}
            {shown.length === 0 ? (
              <p className="px-3.5 py-3 text-sm text-ink-700/70">
                Nothing matches “{query.trim()}”. Choose <span className="font-semibold">Other</span> if yours isn&apos;t listed.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
