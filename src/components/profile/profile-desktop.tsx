import { ProfileSections } from "@/components/profile/profile-sections";
import { CompatibilityPanel, type ViewerCompat } from "@/components/profile/compatibility-panel";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ProfileView } from "@/lib/profile";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { ProfileHero } from "@/components/profile/profile-hero";
import type { ProfileSlide } from "@/components/profile/profile-photo-slider";

export function ProfileDesktop({
  profile,
  showEditTab = false,
  navProfileCode,
  footer,
  hideNav = false,
  backHref = "/browse",
  backLabel = "Back to browse",
  unreadCount = 0,
  embedded = false,
  photoOverrideUrl,
  photoOverrideVisible,
  viewerCompat,
  presence,
  slides,
}: {
  profile: ProfileView;
  showEditTab?: boolean;
  /** Logged-in user's code for nav (not the profile being viewed) */
  navProfileCode?: string | null;
  footer?: ReactNode;
  /** Omit the site nav — used for restricted viewers (e.g. wali) who shouldn't see Browse/Chats/Settings links */
  hideNav?: boolean;
  backHref?: string;
  backLabel?: string;
  unreadCount?: number;
  /** Render as an inline panel (no min-h-screen/page padding, no "back to browse" footer) — used to embed inside the chat Profile tab */
  embedded?: boolean;
  /** Override the photo shown/blurred instead of the profile's own moderation-approval status — used by chat, which gates on per-match sharing (photoVisible / one-time-photo), not on photo moderation status */
  photoOverrideUrl?: string | null;
  photoOverrideVisible?: boolean;
  viewerCompat?: ViewerCompat | null;
  /** Real presence for the member being viewed — one source of truth with Browse. */
  presence?: { online: boolean; label: string; justJoined?: boolean } | null;
  /** All photos this viewer may see, main first. Defaults to the single profile photo. */
  slides?: ProfileSlide[];
}) {
  const isOwn = showEditTab;
  const avatarSrc =
    photoOverrideUrl !== undefined ? photoOverrideUrl : profile.photoUrl;
  const avatar = avatarSrc || `https://i.pravatar.cc/240?img=${(profile.avatarSeed % 70) + 1}`;
  const photoVisible =
    photoOverrideVisible !== undefined ? photoOverrideVisible : true;
  const photoHidden = photoOverrideVisible === false && !avatarSrc;
  const heroSlides: ProfileSlide[] =
    slides && slides.length > 0 ? slides : avatarSrc ? [{ id: "main", url: avatarSrc }] : [];
  const outstanding = profile.checklist.filter((c) => !c.done);

  return (
    <div className={embedded ? "text-ink-900" : `min-h-screen bg-[#faf8f7] text-ink-900 ${hideNav ? "" : "lg:pl-60"}`}>
      {hideNav || embedded ? null : (
        <BrowseAppNav
          profileCode={navProfileCode ?? (isOwn ? profile.profileCode : null)}
          active={isOwn ? "profile" : "browse"}
          unreadCount={unreadCount}
        />
      )}

      {/* Same photo-led design as the phone, scaled up: one centred column. */}
      <main
        className={
          embedded
            ? "px-4 sm:px-6 py-5"
            : "max-w-4xl mx-auto px-5 sm:px-8 py-6 pb-[var(--pn-bottom-nav-h)]"
        }
      >
        {embedded ? null : (
          <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <Link
              href={backHref}
              className="justify-self-start inline-flex items-center gap-2 text-sm font-medium text-ink-700/70 hover:text-ink-950"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {backLabel}
            </Link>
            {showEditTab ? (
              <div className="flex gap-10 text-[15px]">
                <span className="pb-2 font-bold text-ink-950 border-b-[3px] border-ink-950">Preview</span>
                <Link href="/profile/edit" className="pb-2 font-medium text-ink-700/50 hover:text-ink-900">
                  Edit
                </Link>
              </div>
            ) : (
              <span />
            )}
            <span />
          </div>
        )}

        <ProfileHero
          profile={profile}
          slides={heroSlides}
          showPhoto={photoVisible}
          photoHidden={photoHidden}
          fallbackSrc={avatar}
          presence={isOwn ? null : presence}
          size={embedded ? "panel" : "wide"}
        />

        <div className="mt-4 space-y-4">
          {profile.plan === "gold" && !profile.hideGoldBadge ? (
            <div>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-[13px] font-medium">
                Gold
              </span>
            </div>
          ) : null}

          {!isOwn && footer ? (
            <div className="card p-6">
              <h2 className="text-lg font-bold text-ink-950 mb-3">Connect</h2>
              {footer}
            </div>
          ) : null}

          {viewerCompat ? <CompatibilityPanel compat={viewerCompat} /> : null}

          <ProfileSections profile={profile} card />

          {isOwn ? (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink-950">Profile completeness</h2>
                <span className="text-rose-600 font-bold">{profile.completeness}%</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-ink-900/8 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${profile.completeness}%`,
                    background: "linear-gradient(90deg,#aa1945,#d14f82)",
                  }}
                />
              </div>
              {outstanding.length > 0 ? (
                <div className="mt-4 space-y-0.5">
                  {outstanding.map((c) => (
                    <div key={c.label} className="detail-row">
                      <span className="flex items-center gap-2.5 text-sm text-ink-900">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                        {c.label}
                      </span>
                      {c.action === "edit" ? (
                        <Link href="/profile/edit" className="text-xs font-semibold" style={{ color: "#c8952b" }}>
                          Complete
                        </Link>
                      ) : null}
                      {c.action === "review" ? (
                        <span className="text-xs font-semibold text-ink-700/50">Pending review</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {!profile.culturalVerified ? (
                <p className="mt-4 text-[12px] text-ink-700/60 leading-relaxed">
                  Cultural verification is confirmed by the PN team (Pashtun / community authenticity). Filling
                  your profile does not flip this automatically — it does not reduce your completeness %.
                </p>
              ) : null}
              <Link
                href="/profile/edit"
                className="mt-5 block text-center py-3 rounded-full text-white font-semibold text-sm"
                style={{ background: "linear-gradient(135deg,#aa1945,#d14f82)" }}
              >
                {profile.completeness >= 100 ? "Edit my profile" : "Complete my profile"}
              </Link>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
