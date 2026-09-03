"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="px-4 py-2 rounded-full border border-ink-900/12 text-ink-900 text-sm font-semibold hover:bg-ink-900/5 transition disabled:opacity-60"
    >
      {loading ? "…" : "Log out"}
    </button>
  );
}
