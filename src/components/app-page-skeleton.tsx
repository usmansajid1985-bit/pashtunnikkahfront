/**
 * Static route-transition skeleton. Rendered instantly by `loading.tsx` files while
 * the server component for a route streams in. No data, no client JS — its only job
 * is to make navigation between authenticated pages feel immediate instead of
 * blocking on a ~1–2s server render.
 */
export function AppPageSkeleton({
  variant = "list",
}: {
  variant?: "list" | "grid" | "detail";
}) {
  return (
    <div className="min-h-screen bg-[#faf8f7] lg:pl-60">
      {/* Desktop sidebar placeholder */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-60 lg:flex-col lg:border-r lg:border-ink-900/8 lg:bg-white px-4 py-6">
        <div className="flex items-center gap-2.5 px-1">
          <div className="skeleton h-[30px] w-[30px] rounded-lg" />
          <div className="skeleton h-4 w-32" />
        </div>
        <div className="mt-8 flex flex-col gap-2.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-full rounded-xl" />
          ))}
        </div>
      </aside>

      {/* Mobile top bar placeholder */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-ink-900/8">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="skeleton h-6 w-36" />
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton mt-3 h-4 w-72" />

        {variant === "grid" ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-ink-900/6 bg-white p-4">
                <div className="skeleton h-40 w-full rounded-xl" />
                <div className="skeleton mt-3 h-4 w-2/3" />
                <div className="skeleton mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : variant === "detail" ? (
          <div className="mt-8 max-w-2xl space-y-4">
            <div className="skeleton h-48 w-full rounded-2xl" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-ink-900/6 bg-white p-4"
              >
                <div className="skeleton h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton mt-2 h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
