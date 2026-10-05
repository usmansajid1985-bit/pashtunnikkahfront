"use client";

import { useState } from "react";

/** Labelled password input with a Show / Hide toggle. Pasting and password managers work as normal. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  maxLength,
  invalid,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink-9 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="field"
          style={{ paddingRight: 44 }}
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-700/60 hover:text-ink-900"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {shown ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c5.5 0 9 5.2 9.8 7-.3.7-1.1 2-2.3 3.3M6.5 6.6C4 8.2 2.6 10.9 2.2 12c.8 1.8 4.3 7 9.8 7 1.6 0 3-.4 4.2-1" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </>
            ) : (
              <>
                <path d="M2.2 12C3 10.2 6.5 5 12 5s9 5.2 9.8 7c-.8 1.8-4.3 7-9.8 7s-9-5.2-9.8-7Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
