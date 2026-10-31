"use client";

import { useEffect, useState } from "react";
import { IconBadge, IconField, MailIcon, PersonIcon, PhoneIcon, LinkIcon, primaryWaliBtn } from "./wali-ui";

export function GuardianContactManager() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("");
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
          setRelation(d.guardian.relation || "");
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
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          email: email.trim(),
          relation: relation.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save contact.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="wali-contact"
      className="scroll-mt-24 bg-white rounded-2xl border border-ink-900/8 p-5 space-y-4 lg:col-span-2"
    >
      <div className="flex items-start gap-3">
        <IconBadge><PersonIcon /></IconBadge>
        <div>
          <h2 className="text-[17px] font-bold text-ink-950">Wali Contact Details</h2>
          <p className="text-[13px] text-ink-700/60 mt-0.5 leading-snug">
            Add your wali&apos;s or mother&apos;s details. You can share them in chat once a match is accepted.
          </p>
        </div>
      </div>

      {loading ? <p className="text-sm text-ink-700/50">Loading…</p> : (
      <>
      <div className="grid sm:grid-cols-2 gap-3">
        <IconField
          label="Full name"
          icon={<PersonIcon />}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Abdul Rahman"
        />
        <IconField
          label="Phone number"
          icon={<PhoneIcon />}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="e.g. +44 7911 123456"
          type="tel"
        />
        <IconField
          label="Relationship to you (optional)"
          icon={<LinkIcon />}
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          placeholder="e.g. Father"
          maxLength={64}
        />
        <IconField
          label="Email (optional)"
          icon={<MailIcon />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. wali@example.com"
          type="email"
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className={primaryWaliBtn}>
          {busy ? "Saving…" : "Save details"}
        </button>
      </div>
      {saved ? <p className="text-sm text-emerald-700 font-medium">Saved.</p> : null}

      {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p> : null}
      </>
      )}
    </section>
  );
}
