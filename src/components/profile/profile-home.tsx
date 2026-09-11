"use client";

import { useRef, useState } from "react";
import type { ProfileView } from "@/lib/profile";
import { ProfilePreview } from "@/components/profile/profile-preview";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";

type PhotoItem = {
  id: string;
  url: string;
  isMain: boolean;
  status: "pending" | "approved" | "rejected";
  sortOrder: number;
};

/**
 * Own-profile Preview + Edit. Desktop keeps the existing separate pages/tabs (real navigation,
 * per QA item 20 — "Desktop/laptop should continue to use the visible tabs/buttons"). On mobile
 * both panels are mounted at once and the user can drag directly between them, mirroring the
 * Chat↔Profile pane-drag built for QA item 5: the panel tracks the finger in real time rather
 * than "detect a swipe, then navigate."
 */
export function ProfileHome({
  profile,
  unreadCount = 0,
  photos = [],
  initialTab,
}: {
  profile: ProfileView;
  unreadCount?: number;
  photos?: PhotoItem[];
  initialTab: "preview" | "edit";
}) {
  const [tab, setTab] = useState<"preview" | "edit">(initialTab);
  const [paneDrag, setPaneDrag] = useState(0);
  const paneDragRef = useRef<{
    x: number;
    y: number;
    axis: "x" | "y" | null;
    startTab: "preview" | "edit";
    width: number;
    lastX: number;
    lastT: number;
    vx: number;
    dist: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  function paneTouchStart(e: React.TouchEvent) {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const el = e.target as HTMLElement;
    if (el.closest("input,textarea,select,[data-no-pane-swipe]")) return;
    const t = e.touches[0];
    const width = viewportRef.current?.clientWidth || window.innerWidth;
    paneDragRef.current = {
      x: t.clientX,
      y: t.clientY,
      axis: null,
      startTab: tab,
      width,
      lastX: t.clientX,
      lastT: performance.now(),
      vx: 0,
      dist: 0,
    };
  }
  function paneTouchMove(e: React.TouchEvent) {
    const d = paneDragRef.current;
    if (!d) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (d.axis === null) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      d.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    }
    if (d.axis !== "x") return;
    const now = performance.now();
    d.vx = (t.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = t.clientX;
    d.lastT = now;
    // From Preview you can only pull Edit in (drag left, dx<0). From Edit only push it out (dx>0).
    const clamped = d.startTab === "preview" ? Math.min(0, dx) : Math.max(0, dx);
    d.dist = clamped;
    setPaneDrag(clamped);
  }
  function paneTouchEnd() {
    const d = paneDragRef.current;
    paneDragRef.current = null;
    if (!d || d.axis !== "x") {
      setPaneDrag(0);
      return;
    }
    const dir = d.startTab === "preview" ? -1 : 1;
    const passedDistance = Math.abs(d.dist) > d.width * 0.33;
    const flicked = Math.abs(d.vx) > 0.4 && Math.sign(d.vx) === dir && Math.abs(d.dist) > 24;
    if (passedDistance || flicked) setTab(d.startTab === "preview" ? "edit" : "preview");
    setPaneDrag(0);
  }

  const paneDragPct = viewportRef.current?.clientWidth
    ? (paneDrag / viewportRef.current.clientWidth) * 100
    : 0;
  const editPanelPct = Math.max(0, Math.min(100, (tab === "preview" ? 100 : 0) + paneDragPct));
  const paneDragging = paneDragRef.current?.axis === "x";

  return (
    <>
      {/* Desktop: unchanged — a real page per tab, plain navigation, no drag. */}
      <div className="hidden lg:block">
        {initialTab === "preview" ? (
          <ProfilePreview profile={profile} showEditTab closeHref="/settings" unreadCount={unreadCount} />
        ) : (
          <ProfileEditForm initial={profile} unreadCount={unreadCount} photos={photos} />
        )}
      </div>

      {/* Mobile: both panels mounted, dragged directly by the finger. */}
      <div className="lg:hidden bg-white min-h-screen">
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-ink-900/6">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <a
              href="/settings"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            </a>
            <div className="flex gap-8 text-[15px]">
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`pb-2.5 ${
                  tab === "preview"
                    ? "font-bold text-ink-950 border-b-[3px] border-ink-950"
                    : "font-medium text-ink-700/50"
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setTab("edit")}
                className={`pb-2.5 ${
                  tab === "edit"
                    ? "font-bold text-ink-950 border-b-[3px] border-ink-950"
                    : "font-medium text-ink-700/50"
                }`}
              >
                Edit
              </button>
            </div>
            <span className="w-10" />
          </div>
        </div>

        <div
          ref={viewportRef}
          className="relative overflow-hidden"
          style={{ touchAction: "pan-y" }}
          onTouchStart={paneTouchStart}
          onTouchMove={paneTouchMove}
          onTouchEnd={paneTouchEnd}
          onTouchCancel={paneTouchEnd}
        >
          {/* PREVIEW — base panel, always in place */}
          <div>
            <ProfilePreview
              profile={profile}
              showEditTab
              closeHref="/settings"
              unreadCount={unreadCount}
              showMobileChrome={false}
            />
          </div>

          {/* EDIT — slides in over Preview */}
          <div
            className="absolute inset-0 z-10 bg-[#faf8f7] overflow-y-auto"
            style={{
              transform: `translateX(${editPanelPct}%)`,
              transition: paneDragging ? "none" : "transform 300ms cubic-bezier(0.22,1,0.36,1)",
              pointerEvents: editPanelPct > 99 ? "none" : undefined,
            }}
          >
            <ProfileEditForm initial={profile} unreadCount={unreadCount} photos={photos} hideMobileHeader />
          </div>
        </div>
      </div>
    </>
  );
}
