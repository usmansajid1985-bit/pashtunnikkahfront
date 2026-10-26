import { ProfileSections } from "@/components/profile/profile-sections";
import { CompatibilityPanel, type ViewerCompat } from "@/components/profile/compatibility-panel";
import type { ProfileView } from "@/lib/profile";
import type { ReactNode } from "react";
import { ProfileDesktop } from "@/components/profile/profile-desktop";
import { MatchActions } from "@/components/matches/match-actions";
import { MobileBottomNavGate } from "@/components/browse/mobile-bottom-nav-gate";
import type { MatchRelationStatus } from "@/lib/matches";
import type { ProfileSlide } from "@/components/profile/profile-photo-slider";
import { ProfileHero } from "@/components/profile/profile-hero";
import { HeroBackButton, HeroMoreMenu, SaveProfileButton } from "@/components/profile/profile-hero-controls";

export function ProfilePreview({
  profile,
  showEditTab = false,
  closeHref = "/browse",
  matchStatus,
  requestBlockedReason = null,
  navProfileCode,
  hideNav = false,
  backHref,
  backLabel,
  unreadCount = 0,
  viewerCompat,
  presence,
  photoVisible,
  showMobileChrome = true,
  photoAccessory,
  photos = [],
  saved,
}: {
  profile: ProfileView;
  showEditTab?: boolean;
  closeHref?: string;
  matchStatus?: MatchRelationStatus;
  /** Why this viewer can't send/accept requests right now (e.g. awaiting approval). */
  requestBlockedReason?: string | null;
  /** Server-resolved: is the viewer allowed to see this photo unblurred? Undefined = use the
   * profile's own moderation status (own profile / edit preview). */
  photoVisible?: boolean;
  navProfileCode?: string | null;
  /** Omit the site nav — used for restricted viewers (e.g. wali) who shouldn't see Browse/Chats/Settings links */
  hideNav?: boolean;
  backHref?: string;
  backLabel?: string;
  unreadCount?: number;
  /** Gold viewer compatibility breakdown for the profile being viewed */
  viewerCompat?: ViewerCompat | null;
  /** Real presence for the member being viewed — one source of truth with Browse. */
  presence?: { online: boolean; label: string; justJoined?: boolean } | null;
  /** false when embedded inside the Preview/Edit swipe shell, which owns the top bar + bottom CTA. */
  showMobileChrome?: boolean;
  /** Rendered under the photo (e.g. the matched member's Private Photo Reveal entry, PH06). */
  photoAccessory?: ReactNode;
  /** Extra profile photos (own preview, or a matched viewer). Main photo first. */
  photos?: ProfileSlide[];
  /** Viewer has bookmarked this member — set on a member's profile, enables the Bookmark button. */
  saved?: boolean;
}) {
  const avatar = profile.photoUrl || `https://i.pravatar.cc/240?img=${(profile.avatarSeed % 70) + 1}`;
  const slides: ProfileSlide[] = (
    photos.length > 0
      ? [...photos]
          .filter((p) => p.url)
          .sort((a, b) => Number(!!b.isMain) - Number(!!a.isMain))
      : profile.photoUrl
        ? [{ id: "main", url: profile.photoUrl }]
        : []
  );
  // Server decides for other people's profiles; the owner always sees their own photo (K10).
  const showPhoto = photoVisible !== undefined ? photoVisible : true;
  const photoHidden = photoVisible === false && !profile.photoUrl;
  // Someone else's profile opened as a member (not own preview, not a wali view): Report/Block
  // menu over the photo, and on phones the tab bar gives way to Request match + Bookmark.
  const memberView = !showEditTab && !hideNav && Boolean(matchStatus);
  const saveButton = memberView && saved !== undefined ? <SaveProfileButton userId={profile.userId} initialSaved={saved} /> : null;
  const moreMenu = memberView ? <HeroMoreMenu userId={profile.userId} code={profile.profileCode} afterBlockHref={backHref || "/browse"} /> : null;

  return (
    <>
      {/* Desktop — full-width 2-col layout */}
      <div className="hidden lg:block">
        <ProfileDesktop
          profile={profile}
          showEditTab={showEditTab}
          navProfileCode={navProfileCode}
          hideNav={hideNav}
          backHref={backHref}
          backLabel={backLabel}
          unreadCount={unreadCount}
          viewerCompat={viewerCompat}
          presence={presence}
          slides={slides}
          photoOverrideVisible={photoVisible}
          photoOverrideUrl={photoVisible === undefined ? undefined : profile.photoUrl}
          // N45: a matched profile opened from Browse shows only "Matched – go to chat".
          footerTitle={null}
          heroTopLeft={showEditTab ? undefined : <HeroBackButton href={backHref || closeHref} label={backLabel || "Back"} />}
          heroTopRight={moreMenu}
          footer={
            matchStatus || photoAccessory ? (
              <>
                {photoAccessory}
                {matchStatus ? (
                  <MatchActions
                    profileCode={profile.profileCode}
                    initial={matchStatus}
                    layout="inline"
                    blockedReason={requestBlockedReason}
                    trailing={saveButton}
                  />
                ) : null}
              </>
            ) : null
          }
        />
      </div>

      {/* Mobile — photo-led hero preview */}
      <div className={`lg:hidden min-h-full ${showEditTab ? "bg-white" : "bg-[#f6f5f4]"}`}>
      {/* Top bar — own profile only; a member's profile puts ← and ⋯ over the photo instead. */}
      {showMobileChrome && showEditTab ? (
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-900/6">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <a
            href={closeHref}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </a>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-ink-950 text-[16px]">{profile.fullName.split(" ")[0]}</span>
            {profile.verified ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#9ca3af">
                <path d="M12 2l2.2 4.6L19 7.2l-3.4 3.3.8 4.8L12 13.5 7.6 15.3l.8-4.8L5 7.2l4.8-.6L12 2Z" />
              </svg>
            ) : null}
          </div>
          <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5" aria-label="Share">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="18" cy="5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="19" r="2.5" />
              <path d="m8.2 10.8 7.5-4.2M8.2 13.2l7.5 4.2" />
            </svg>
          </button>
        </div>

        {showEditTab ? (
          <div className="max-w-lg mx-auto px-4 flex gap-8 text-[15px]">
            <span className="pb-2.5 font-bold text-ink-950 border-b-[3px] border-ink-950">Preview</span>
            <a href="/profile/edit" className="pb-2.5 font-medium text-ink-700/50 hover:text-ink-900">
              Edit
            </a>
          </div>
        ) : null}
      </div>
      ) : null}

      {/* Photo-led hero */}
      <ProfileHero
        profile={profile}
        slides={slides}
        showPhoto={showPhoto}
        photoHidden={photoHidden}
        fallbackSrc={avatar}
        presence={presence}
        topLeft={showMobileChrome && !showEditTab ? <HeroBackButton href={closeHref} /> : undefined}
        topRight={showMobileChrome ? moreMenu : undefined}
        photoCount={showEditTab}
      />

      <div
        className={`max-w-lg mx-auto px-3 ${
          memberView && showMobileChrome
            ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
            : showMobileChrome
              ? "pb-[calc(7rem+var(--pn-bottom-nav-h))]"
              : "pb-[calc(1.5rem+var(--pn-bottom-nav-h))]"
        }`}
      >
        {photoAccessory ? <div className="pt-4 -mx-4">{photoAccessory}</div> : null}

        {viewerCompat ? (
          <div className="mt-3">
            <CompatibilityPanel compat={viewerCompat} compact />
          </div>
        ) : null}

        <div className="mt-3 space-y-3">
          <ProfileSections profile={profile} />
        </div>

        {/* Completeness mini — own profile only */}
        {showEditTab ? (
        <div className="mt-8 rounded-2xl border border-ink-900/8 p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink-950">Profile completeness</p>
            <p className="font-bold text-rose-600">{profile.completeness}%</p>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-ink-900/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400"
              style={{ width: `${profile.completeness}%` }}
            />
          </div>
        </div>
        ) : null}
      </div>

      {/* Bottom CTA — mobile only */}
      {!showMobileChrome || hideNav || memberView ? null : (
        <MobileBottomNavGate active="browse" unreadCount={unreadCount} />
      )}
      {!showMobileChrome ? null : showEditTab ? (
        <div className="fixed bottom-[var(--pn-bottom-nav-h)] inset-x-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 lg:hidden">
          <div className="max-w-lg mx-auto px-4 flex gap-2">
            <a
              href="/profile/edit"
              className="flex-1 text-center py-3.5 rounded-2xl bg-rose-600 text-white font-semibold text-[15px] hover:bg-rose-700 shadow-[0_12px_28px_-12px_rgba(170,25,69,0.55)]"
            >
              Edit my profile
            </a>
          </div>
        </div>
      ) : matchStatus ? (
        <div className="lg:hidden">
          <MatchActions
            profileCode={profile.profileCode}
            initial={matchStatus}
            layout={memberView ? "bar" : "fixed"}
            blockedReason={requestBlockedReason}
            trailing={saveButton}
          />
        </div>
      ) : (
        <div className="fixed bottom-[var(--pn-bottom-nav-h)] inset-x-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 lg:hidden">
          <div className="max-w-lg mx-auto px-4 flex gap-2">
            <a
              href={backHref || "/browse"}
              className="flex-1 text-center py-3.5 rounded-2xl bg-rose-600 text-white font-semibold text-[15px] hover:bg-rose-700"
            >
              {backLabel || "Back to browse"}
            </a>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
