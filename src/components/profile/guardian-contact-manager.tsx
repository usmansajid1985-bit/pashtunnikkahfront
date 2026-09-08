"use client";

import { useEffect, useState } from "react";

export function GuardianContactManager() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile/guardian")
      .then((r) => r.json())
      .then((d) => {
        if (d.guardian) {
          setName(d.guardian.name || "");
          setContact(d.guardian.contact || "");
          setEmail(d.guardian.email || "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const res = await fetch("/api/profile/guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save guardian contact.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-2xl border border-ink-900/8 p-5 lg:col-span-2">
        <p className="text-sm text-ink-700/50">Loading…</p>
      </section>
    );
  }

  return (
    <section
      id="wali-contact"
      className="scroll-mt-24 bg-white rounded-2xl border border-ink-900/8 p-5 space-y-4 lg:col-span-2"
    >
      <div>
        <h2 className="font-bold text-ink-950">Wali or Mother Contact Card</h2>
        <p className="text-xs text-ink-700/55 mt-0.5">
          Add your wali&apos;s or mother&apos;s name and phone number. Once a match is accepted, you can
          send this as a contact card in chat so the other member can reach them directly.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Wali name</label>
          <input
            className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Abdul Rahman"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Phone number</label>
          <input
            className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="e.g. +44 7911 123456"
            type="tel"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold mb-1">Email (optional)</label>
          <input
            className="w-full rounded-xl border border-[#ece7e6] bg-[#faf8f7] px-3.5 py-2.5 text-sm focus:outline-none focus:border-rose-300 focus:bg-white focus:ring-3 focus:ring-rose-600/10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. wali@example.com"
            type="email"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="px-4 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save guardian contact"}
          </button>
          {saved ? <span className="text-sm text-emerald-700 font-medium">Saved.</span> : null}
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p> : null}
    </section>
  );
}
