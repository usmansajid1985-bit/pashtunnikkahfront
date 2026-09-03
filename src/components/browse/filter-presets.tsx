"use client";

import { useEffect, useState, useTransition } from "react";
import { BrowseFilters, filtersToQuery } from "@/lib/browse-filters-shared";

type Preset = { id: string; name: string; filters: Partial<BrowseFilters> };

export function FilterPresets({
  isGold,
  currentFilters,
  onLoad,
}: {
  isGold: boolean;
  currentFilters: BrowseFilters;
  onLoad: (filters: BrowseFilters) => void;
}) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!isGold) return;
    void fetch("/api/browse/presets")
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []))
      .catch(() => {});
  }, [isGold]);

  if (!isGold) return null;

  function savePreset() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMsg(null);
    startTransition(async () => {
      const { page: _p, ...filters } = currentFilters;
      const res = await fetch("/api/browse/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, filters }),
      });
      if (!res.ok) {
        setMsg("Could not save preset");
        return;
      }
      setName("");
      setMsg("Preset saved");
      const list = await fetch("/api/browse/presets").then((r) => r.json());
      setPresets(list.presets ?? []);
    });
  }

  function deletePreset(id: string) {
    startTransition(async () => {
      await fetch(`/api/browse/presets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setPresets((prev) => prev.filter((p) => p.id !== id));
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
        Presets
      </span>
      {presets.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              onLoad({
                ...currentFilters,
                ...p.filters,
                page: 1,
              } as BrowseFilters)
            }
            className="px-2.5 py-1 rounded-full border border-ink-900/10 text-xs font-semibold hover:border-rose-300"
          >
            {p.name}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => deletePreset(p.id)}
            className="text-ink-700/40 hover:text-rose-600 text-xs"
            aria-label={`Delete ${p.name}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 80))}
        placeholder="Save as…"
        className="text-xs rounded-full border border-ink-900/10 px-2.5 py-1 w-28 focus:outline-none focus:border-rose-300"
      />
      <button
        type="button"
        disabled={pending || !name.trim()}
        onClick={savePreset}
        className="text-xs font-semibold text-rose-600 disabled:opacity-40"
      >
        Save
      </button>
      {msg ? <span className="text-[11px] text-emerald-700">{msg}</span> : null}
    </div>
  );
}

/** Helper for preset load navigation */
export function presetFiltersToHref(filters: BrowseFilters) {
  return `/browse${filtersToQuery({ ...filters, page: 1 })}`;
}
