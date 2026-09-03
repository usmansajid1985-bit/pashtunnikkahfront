"use client";

import { useState, useTransition } from "react";
import { COMM_MODES } from "@/lib/signup";
import { ChoiceGrid, ChoiceTile, I } from "@/components/signup/choice-tile";

export function CommunicationModeSettings({
  initialMode,
  initialNiqabSub,
  gender,
}: {
  initialMode: string | null;
  initialNiqabSub: string | null;
  gender: string | null;
}) {
  const isSister = (gender || "").toLowerCase().startsWith("f");
  const [mode, setMode] = useState(initialMode || "");
  const [niqabSub, setNiqabSub] = useState(initialNiqabSub || "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isSister) return null;

  function save(nextMode: string, nextSub: string) {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/profile/communication-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationMode: nextMode, niqabSubMode: nextSub }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save");
        return;
      }
      setMsg("Saved. This only applies to future matches.");
    });
  }

  return (
    <section className="mt-5 bg-white rounded-2xl border border-ink-900/6 shadow-[0_8px_30px_-18px_rgba(15,13,14,0.35)] p-4">
      <h3 className="font-bold text-ink-950">Communication mode</h3>
      <p className="mt-1 text-[12.5px] text-ink-700/65 leading-relaxed">
        Only one mode can be active. Changing it only affects future matches — existing chats keep the mode they
        started with.
      </p>

      <div className="mt-4">
        <ChoiceGrid>
          {COMM_MODES.map((m) => {
            const icons = {
              standard: I.chat,
              wali_oversight: I.eye,
              wali_only: I.phone,
              niqab: I.veil,
            } as const;
            return (
              <ChoiceTile
                key={m.id}
                label={m.title}
                icon={icons[m.id as keyof typeof icons]}
                tone={m.id === "standard" ? "sky" : m.id === "wali_oversight" ? "lilac" : m.id === "wali_only" ? "peach" : "rose"}
                selected={mode === m.id}
                onClick={() => {
                  const sub = m.id === "niqab" ? niqabSub || "standard" : "";
                  setMode(m.id);
                  if (m.id !== "niqab") setNiqabSub("");
                  save(m.id, sub);
                }}
              />
            );
          })}
        </ChoiceGrid>
      </div>

      {mode === "niqab" ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-ink-950 mb-2">After matching, prefer:</p>
          <ChoiceGrid>
            {[
              { id: "standard", label: "Standard", icon: I.chat, tone: "sky" as const },
              { id: "wali_oversight", label: "Wali Oversight", icon: I.eye, tone: "lilac" as const },
              { id: "wali_only", label: "Wali-Only", icon: I.phone, tone: "peach" as const },
            ].map((s) => (
              <ChoiceTile
                key={s.id}
                label={s.label}
                icon={s.icon}
                tone={s.tone}
                selected={niqabSub === s.id}
                onClick={() => {
                  setNiqabSub(s.id);
                  save("niqab", s.id);
                }}
              />
            ))}
          </ChoiceGrid>
        </div>
      ) : null}

      {pending ? <p className="mt-3 text-xs text-ink-700/50">Saving…</p> : null}
      {msg ? <p className="mt-3 text-xs text-emerald-700">{msg}</p> : null}
      {error ? <p className="mt-3 text-xs text-rose-700">{error}</p> : null}
    </section>
  );
}
