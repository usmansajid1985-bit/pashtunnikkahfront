"use client";

import { useState, useTransition } from "react";
import { COMM_MODES } from "@/lib/signup";
import { ChoiceGrid, ChoiceTile, I } from "@/components/signup/choice-tile";

// Niqab Mode and Wali-Only Mode were removed entirely (QA item 12) — only Standard and
// Wali Oversight remain selectable here.
const ICONS = { standard: I.chat, wali_oversight: I.eye } as const;

export function CommunicationModeSettings({
  initialMode,
  gender,
}: {
  initialMode: string | null;
  gender: string | null;
}) {
  const isSister = (gender || "").toLowerCase().startsWith("f");
  const [mode, setMode] = useState(initialMode || "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isSister) return null;

  function save(nextMode: string) {
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/profile/communication-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communicationMode: nextMode }),
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
        <ChoiceGrid count={2}>
          {COMM_MODES.map((m) => (
            <ChoiceTile
              key={m.id}
              label={m.title}
              icon={ICONS[m.id as keyof typeof ICONS]}
              tone={m.id === "standard" ? "sky" : "lilac"}
              selected={mode === m.id}
              onClick={() => {
                setMode(m.id);
                save(m.id);
              }}
            />
          ))}
        </ChoiceGrid>
      </div>

      {pending ? <p className="mt-3 text-xs text-ink-700/50">Saving…</p> : null}
      {msg ? <p className="mt-3 text-xs text-emerald-700">{msg}</p> : null}
      {error ? <p className="mt-3 text-xs text-rose-700">{error}</p> : null}
    </section>
  );
}
