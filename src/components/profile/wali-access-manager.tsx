"use client";

import { useCallback, useEffect, useState } from "react";

type WaliMode = "oversight" | "oversight_notify";

type WaliLink = {
  id: string;
  name: string;
  relation: string | null;
  link: string;
  revoked: boolean;
  lastAccessedAt: string | null;
  createdAt: string;
  mode: WaliMode;
  email: string | null;
  acceptedAt: string | null;
};

type Activity = {
  id: string;
  event: string;
  detail: string | null;
  waliName: string | null;
  at: string;
};

/** W05 (Join Conversation dropped — W06 not needed). */
const MODES: { value: WaliMode; label: string; help: string }[] = [
  { value: "oversight", label: "Oversight only", help: "Can read your conversations. No notifications." },
  {
    value: "oversight_notify",
    label: "Oversight + notifications",
    help: "Can read your conversations and gets an email when there's new activity.",
  },
];

const EVENT_LABEL: Record<string, string> = {
  invited: "Invited",
  accepted: "Accepted invitation",
  viewed_conversation: "Viewed a conversation",
  mode_changed: "Settings changed",
  photo_access_granted: "Photo access allowed",
  photo_access_withdrawn: "Photo access withdrawn",
  notified: "Notification sent",
  revoked: "Access removed",
};

const field =
  "w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10";

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WaliAccessManager() {
  const [links, setLinks] = useState<WaliLink[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<WaliMode>("oversight");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadActivity = useCallback(() => {
    fetch("/api/profile/wali/activity")
      .then((r) => r.json())
      .then((d) => setActivity(d.activity || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/profile/wali")
      .then((r) => r.json())
      .then((d) => setLinks(d.waliLinks || []))
      .finally(() => setLoading(false));
    loadActivity();
  }, [loadActivity]);

  async function addWali() {
    setError(null);
    setNotice(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name.");
      return;
    }
    if (mode === "oversight_notify" && !email.trim()) {
      setError("Add your wali's email so they can receive notifications.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile/wali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          relation: relation.trim() || undefined,
          email: email.trim() || undefined,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create link.");
        return;
      }
      setLinks((prev) => [data.waliLink, ...prev]);
      setNotice(
        data.emailed
          ? `Invitation emailed to ${email.trim()}. You can also copy the link below.`
          : "Link created — copy it below and send it to your wali privately."
      );
      setName("");
      setRelation("");
      setEmail("");
      setMode("oversight");
      loadActivity();
    } finally {
      setBusy(false);
    }
  }

  async function update(l: WaliLink, patch: { mode?: WaliMode; email?: string }) {
    setError(null);
    const res = await fetch(`/api/profile/wali/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not update.");
      return;
    }
    setLinks((prev) => prev.map((x) => (x.id === l.id ? { ...x, mode: data.mode, email: data.email } : x)));
    loadActivity();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this person's access? The link will stop working immediately.")) return;
    const res = await fetch(`/api/profile/wali/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, revoked: true } : l)));
      loadActivity();
    }
  }

  async function copy(link: WaliLink) {
    try {
      await navigator.clipboard.writeText(link.link);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const shownActivity = showAllActivity ? activity : activity.slice(0, 8);

  return (
    <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-4 lg:col-span-2" id="wali">
      <div>
        <h2 className="font-bold text-ink-950">Wali or Mother Oversight</h2>
        <p className="text-xs text-ink-700/55 mt-0.5">
          Give your wali or mother a private link to view your chats and profile — read-only, no
          messaging. Choose whether they also get email notifications. You can change this or remove
          access at any time.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold mb-1">Name</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Abdul Rahman" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Relation (optional)</label>
          <input className={field} value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="e.g. Father" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold mb-1">
            Email {mode === "oversight_notify" ? "(needed for notifications)" : "(optional — we'll email them the invitation)"}
          </label>
          <input
            className={field}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. abdulrahman@email.com"
          />
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold mb-1">Access</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm ${
                  mode === m.value ? "border-rose-300 bg-rose-50/60" : "border-ink-900/10"
                }`}
              >
                <input
                  type="radio"
                  name="wali-mode"
                  className="sr-only"
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                <span className="font-semibold text-ink-950">{m.label}</span>
                <span className="block text-[12px] text-ink-700/60">{m.help}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => void addWali()}
            disabled={busy}
            className="px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Invite wali"}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{notice}</p> : null}

      {loading ? (
        <p className="text-sm text-ink-700/50">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-ink-700/50">No one added yet.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <div
              key={l.id}
              className={`rounded-xl border px-3.5 py-3 space-y-2 ${
                l.revoked ? "border-ink-900/8 bg-ink-900/[0.02] opacity-60" : "border-ink-900/10"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[140px]">
                  <p className="font-semibold text-sm text-ink-950">
                    {l.name}
                    {l.relation ? <span className="text-ink-700/50 font-normal"> · {l.relation}</span> : null}
                  </p>
                  <p className="text-[11px] text-ink-700/45">
                    {l.revoked
                      ? "Access removed"
                      : l.acceptedAt
                        ? `Connected · last viewed ${l.lastAccessedAt ? when(l.lastAccessedAt) : "—"}`
                        : "Invitation not opened yet"}
                  </p>
                </div>
                {!l.revoked ? (
                  <>
                    <input
                      readOnly
                      value={l.link}
                      className="flex-1 min-w-[160px] rounded-lg border border-ink-900/10 bg-[#faf8f7] px-2.5 py-1.5 text-xs text-ink-700/70"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => copy(l)}
                      className="px-3 py-1.5 rounded-full border border-ink-900/12 text-xs font-semibold hover:border-rose-300"
                    >
                      {copiedId === l.id ? "Copied" : "Copy link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(l.id)}
                      className="px-3 py-1.5 rounded-full border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50"
                    >
                      Revoke
                    </button>
                  </>
                ) : null}
              </div>
              {!l.revoked ? (
                <label className="flex items-center gap-2 text-[13px] text-ink-800">
                  <input
                    type="checkbox"
                    checked={l.mode === "oversight_notify"}
                    onChange={(e) => {
                      const on = e.target.checked;
                      if (on && !l.email) {
                        const addr = prompt(`Enter ${l.name}'s email for notifications:`)?.trim();
                        if (!addr) return;
                        void update(l, { mode: "oversight_notify", email: addr });
                        return;
                      }
                      void update(l, { mode: on ? "oversight_notify" : "oversight" });
                    }}
                    className="h-4 w-4 accent-rose-600"
                  />
                  Email notifications about new activity
                  {l.email ? <span className="text-ink-700/50">({l.email})</span> : null}
                </label>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-ink-900/6">
        <h3 className="font-semibold text-sm text-ink-950">Activity log</h3>
        <p className="text-[12px] text-ink-700/55">Everything your walis have done — kept even after access is removed.</p>
        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-ink-700/50">No activity yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink-900/6">
            {shownActivity.map((a) => (
              <li key={a.id} className="py-2 flex gap-3 text-[13px]">
                <span className="w-32 shrink-0 text-ink-700/55">{when(a.at)}</span>
                <span className="min-w-0">
                  <span className="font-semibold text-ink-950">{EVENT_LABEL[a.event] ?? a.event}</span>
                  {a.detail ? <span className="text-ink-700/75"> — {a.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {activity.length > 8 ? (
          <button
            type="button"
            onClick={() => setShowAllActivity((v) => !v)}
            className="mt-1 text-xs font-semibold text-rose-700 hover:underline"
          >
            {showAllActivity ? "Show less" : `Show all ${activity.length}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
