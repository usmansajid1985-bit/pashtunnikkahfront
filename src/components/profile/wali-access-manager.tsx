"use client";

import { useEffect, useState } from "react";

type WaliLink = {
  id: string;
  name: string;
  relation: string | null;
  link: string;
  revoked: boolean;
  lastAccessedAt: string | null;
  createdAt: string;
};

export function WaliAccessManager() {
  const [links, setLinks] = useState<WaliLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile/wali")
      .then((r) => r.json())
      .then((d) => setLinks(d.waliLinks || []))
      .finally(() => setLoading(false));
  }, []);

  async function addWali() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for this wali.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile/wali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, relation: relation.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create link.");
        return;
      }
      setLinks((prev) => [data.waliLink, ...prev]);
      setName("");
      setRelation("");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this wali's access? The link will stop working immediately.")) return;
    const res = await fetch(`/api/profile/wali/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, revoked: true } : l)));
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

  return (
    <section className="bg-white rounded-2xl border border-ink-900/8 p-5 space-y-4 lg:col-span-2">
      <div>
        <h2 className="font-bold text-ink-950">Wali or Mother Oversight</h2>
        <p className="text-xs text-ink-700/55 mt-0.5">
          Give your wali or mother a private link to view your chats and profile only — read-only, no
          messaging. You can add more than one and revoke access at any time.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-semibold mb-1">Name</label>
          <input
            className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Abdul Rahman"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-semibold mb-1">Relation (optional)</label>
          <input
            className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            placeholder="e.g. Father"
          />
        </div>
        <button
          type="button"
          onClick={() => void addWali()}
          disabled={busy}
          className="px-4 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add wali"}
        </button>
      </div>

      {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-ink-700/50">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-ink-700/50">No wali added yet.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <div
              key={l.id}
              className={`rounded-xl border px-3.5 py-3 flex flex-wrap items-center gap-3 ${
                l.revoked ? "border-ink-900/8 bg-ink-900/[0.02] opacity-60" : "border-ink-900/10"
              }`}
            >
              <div className="min-w-[140px]">
                <p className="font-semibold text-sm text-ink-950">
                  {l.name}
                  {l.relation ? <span className="text-ink-700/50 font-normal"> · {l.relation}</span> : null}
                </p>
                <p className="text-[11px] text-ink-700/45">
                  {l.revoked
                    ? "Revoked"
                    : l.lastAccessedAt
                      ? `Last viewed ${new Date(l.lastAccessedAt).toLocaleDateString()}`
                      : "Not viewed yet"}
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
          ))}
        </div>
      )}
    </section>
  );
}
