"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function MarkNotificationsRead() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllRead: true }),
          });
          router.refresh();
        })
      }
      className="text-sm font-semibold text-rose-600 disabled:opacity-50"
    >
      Mark all read
    </button>
  );
}
