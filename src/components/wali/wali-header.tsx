"use client";

export function WaliHeader({ watchingName }: { watchingName: string }) {
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-900/8">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div>
          <p className="font-bold text-ink-950 text-[15px]">Wali view</p>
          <p className="text-[11px] text-ink-700/55">Read-only — {watchingName.split(" ")[0]}&apos;s chats</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/wali/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="px-3.5 py-2 rounded-full border border-ink-900/12 text-xs font-semibold hover:border-rose-300"
        >
          Exit
        </button>
      </div>
    </header>
  );
}
