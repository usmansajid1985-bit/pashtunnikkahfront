"use client";

import { useEffect, useState } from "react";
import { IN_APP_BANNERS_EVENT } from "@/components/notifications/live-updates";

type Key =
  | "notify_requests"
  | "notify_messages"
  | "notify_profile_views"
  | "notify_wali"
  | "notify_updates"
  | "in_app_banners";

const PUSH_ROWS: { key: Key; label: string; hint: string }[] = [
  { key: "notify_requests", label: "Match requests", hint: "New and accepted requests" },
  { key: "notify_messages", label: "Messages", hint: "New chat messages" },
  { key: "notify_profile_views", label: "Profile views", hint: "When someone views your profile" },
  { key: "notify_wali", label: "Wali & family activity", hint: "Wali handovers and reminders" },
  { key: "notify_updates", label: "Pashtun Nikah updates", hint: "Announcements and new features" },
];

const BANNER_ROW: { key: Key; label: string; hint: string } = {
  key: "in_app_banners",
  label: "In-app banners",
  hint: "Show a banner while you're using Pashtun Nikah.",
};

export const NOTIFY_ALL_EVENT = "pn-notify-all";

export function NotificationCategoryToggles() {
  const [prefs, setPrefs] = useState<Record<Key, boolean> | null>(null);
  const [saving, setSaving] = useState<Key | null>(null);

  useEffect(() => {
    const onAll = (ev: Event) => {
      const on = Boolean((ev as CustomEvent<{ on?: boolean }>).detail?.on);
      setPrefs({
        notify_requests: on,
        notify_messages: on,
        notify_profile_views: on,
        notify_wali: on,
        notify_updates: on,
        in_app_banners: on,
      });
    };
    window.addEventListener(NOTIFY_ALL_EVENT, onAll);
    return () => window.removeEventListener(NOTIFY_ALL_EVENT, onAll);
  }, []);

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
          in_app_banners: d.in_app_banners ?? true,
        })
      )
      .catch(() => setPrefs(null));
  }, []);

  async function toggle(key: Key) {
    if (!prefs) return;
    const next = !prefs[key];
    setPrefs({ ...prefs, [key]: next });
    setSaving(key);
    const res = await fetch("/api/push/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    }).catch(() => null);
    setSaving(null);
    if (!res?.ok) {
      // Not saved — show the switch as it really is.
      setPrefs((p) => (p ? { ...p, [key]: !next } : p));
      return;
    }
    if (key === "in_app_banners") {
      // N10: open pages stop (or start) showing banners straight away, in every tab.
      window.dispatchEvent(new CustomEvent(IN_APP_BANNERS_EVENT, { detail: { on: next } }));
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("pn-prefs");
        channel.postMessage({ inAppBanners: next });
        channel.close();
      }
    }
  }

  function row(item: { key: Key; label: string; hint: string }) {
    const on = prefs?.[item.key] ?? true;
    return (
      <div key={item.key} className="flex items-center justify-between gap-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink-950">{item.label}</p>
          <p className="text-[13px] text-ink-700/55">{item.hint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={item.label}
          disabled={!prefs || saving === item.key}
          onClick={() => toggle(item.key)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
            on ? "bg-[#e12d72]" : "bg-ink-900/15"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>
    );
  }

  const card = "mt-4 bg-white rounded-2xl border border-ink-900/8 shadow-[0_8px_30px_-20px_rgba(15,13,14,0.3)] px-5";

  return (
    <>
      <div className={card}>
        <div className="pt-4">
          <h3 className="font-bold text-ink-950">Push alerts for</h3>
          <p className="text-[13px] text-ink-700/55">These switches control push alerts.</p>
        </div>
        <div className="mt-1 divide-y divide-ink-900/6">{PUSH_ROWS.map(row)}</div>
      </div>
      <div className={`${card} py-1`}>{row(BANNER_ROW)}</div>
    </>
  );
}
