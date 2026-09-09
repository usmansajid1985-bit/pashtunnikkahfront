"use client";

import { useEffect, useState } from "react";

type Key = "notify_requests" | "notify_messages" | "notify_profile_views" | "notify_wali" | "notify_updates";

const ROWS: { key: Key; label: string; hint: string }[] = [
  { key: "notify_requests", label: "Match requests", hint: "New and accepted requests" },
  { key: "notify_messages", label: "Messages", hint: "New chat messages" },
  { key: "notify_profile_views", label: "Profile views", hint: "When someone views your profile" },
  { key: "notify_wali", label: "Wali & family activity", hint: "Wali handovers and reminders" },
  { key: "notify_updates", label: "Pashtun Nikah updates", hint: "Announcements and new features" },
];

export function NotificationCategoryToggles() {
  const [prefs, setPrefs] = useState<Record<Key, boolean> | null>(null);
  const [saving, setSaving] = useState<Key | null>(null);

  useEffect(() => {
    fetch("/api/push/preferences")
      .then((r) => r.json())
      .then((d) =>
        setPrefs({
          notify_requests: d.notify_requests ?? true,
          notify_messages: d.notify_messages ?? true,
          notify_profile_views: d.notify_profile_views ?? true,
          notify_wali: d.notify_wali ?? true,
          notify_updates: d.notify_updates ?? true,
        })
      )
      .catch(() => setPrefs(null));
  }, []);

  async function toggle(key: Key) {
    if (!prefs) return;
    const next = !prefs[key];
    setPrefs({ ...prefs, [key]: next });
    setSaving(key);
    await fetch("/api/push/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    }).catch(() => {});
    setSaving(null);
  }

  return (
    <div className="mt-5 bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-5">
      <h3 className="font-bold text-ink-950">What you&apos;re notified about</h3>
      <div className="mt-3 divide-y divide-ink-900/6">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{row.label}</p>
              <p className="text-xs text-ink-700/55">{row.hint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs?.[row.key] ?? true}
              aria-label={row.label}
              disabled={!prefs || saving === row.key}
              onClick={() => toggle(row.key)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                prefs?.[row.key] ?? true ? "bg-rose-600" : "bg-ink-900/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  prefs?.[row.key] ?? true ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
