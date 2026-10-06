import { iconFor } from "@/lib/profile-optional";
import { CompatibilityPanel, type ViewerCompat } from "@/components/profile/compatibility-panel";
import type { ProfileView } from "@/lib/profile";
import type { ReactNode } from "react";
import { ProfileDesktop } from "@/components/profile/profile-desktop";
import { MatchActions } from "@/components/matches/match-actions";
import { MobileBottomNavGate } from "@/components/browse/mobile-bottom-nav-gate";
import type { MatchRelationStatus } from "@/lib/matches";
import { ProfilePhotoSlider, type ProfileSlide } from "@/components/profile/profile-photo-slider";

function Pill({
  icon,
  children,
  tone = "grey",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "grey" | "rose" | "green" | "amber";
}) {
  const tones = {
    grey: "bg-[#f3f1f0] text-ink-950",
    rose: "bg-rose-50 text-rose-700",
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[17px] font-bold text-ink-950 mb-3">{title}</h2>
      {children}
    </section>
  );
}

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
}) {
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
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
          photoOverrideVisible={photoVisible}
          photoOverrideUrl={photoVisible === undefined ? undefined : profile.photoUrl}
          footer={
            matchStatus || photoAccessory ? (
              <>
                {photoAccessory}
                {matchStatus ? (
                  <MatchActions profileCode={profile.profileCode} initial={matchStatus} layout="inline" blockedReason={requestBlockedReason} />
                ) : null}
              </>
            ) : null
          }
        />
      </div>

      {/* Mobile — photo-led hero preview */}
      <div className="lg:hidden bg-white min-h-full">
      {/* Top bar */}
      {showMobileChrome ? (
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
      <div className="relative w-full overflow-hidden bg-ink-900/10" style={{ aspectRatio: "4 / 5" }}>
        {photoHidden ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ink-900/10 to-ink-900/5">
            <p className="text-sm font-semibold text-ink-700/50 px-10 text-center">
              Photo hidden until you match
            </p>
          </div>
        ) : (
          <ProfilePhotoSlider slides={slides} showPhoto={showPhoto} fallbackSrc={avatar} />
        )}

        {presence ? (
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold backdrop-blur-md ${
                presence.online ? "bg-emerald-500/90 text-white" : "bg-black/40 text-white"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${presence.online ? "bg-white" : "bg-white/60"}`} />
              {presence.label}
            </span>
            {presence.justJoined ? (
              <span className="ml-1.5 inline-flex items-center px-2.5 py-1.5 rounded-full text-[12px] font-semibold bg-amber-400/90 text-ink-950 backdrop-blur-md">
                ✨ Just Joined
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none"
          aria-hidden
        />

        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-5 text-white pointer-events-none">
          <p className="text-[22px] font-bold flex items-center gap-1.5 leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">
            {profile.profileCode}
            {profile.age ? `, ${profile.age}` : ""}
            {profile.verified ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#60a5fa" className="shrink-0">
                <path d="M12 2l2.4 1.4 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L22 12l-1.4 2.4.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 22l-2.4-1.4-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2 12l1.4-2.4-.3-2.8 2.5-1.2 1.2-2.5 2.8.3Z" />
              </svg>
            ) : null}
          </p>
          <p className="text-[13px] text-white/80 mt-0.5">{location || "—"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[profile.occupation, profile.religiousPractice, profile.country, profile.tribe, profile.ancestralRegion, profile.relocation]
              .filter((v): v is string => Boolean(v))
              .map((v, i) => (
                <span
                  key={`${v}-${i}`}
                  className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11.5px] font-medium text-white border border-white/20"
                >
                  {v}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div
        className={`max-w-lg mx-auto px-4 ${
          showMobileChrome ? "pb-[calc(7rem+var(--pn-bottom-nav-h))]" : "pb-[calc(1.5rem+var(--pn-bottom-nav-h))]"
        }`}
      >
        {photoAccessory ? <div className="pt-4 -mx-4">{photoAccessory}</div> : null}

        {profile.maritalStatus || profile.pashto || (profile.plan === "gold" && !profile.hideGoldBadge) ? (
          <div className="pt-4 flex flex-wrap gap-1.5">
            {profile.maritalStatus ? <Pill tone="rose">{profile.maritalStatus}</Pill> : null}
            {profile.pashto && profile.pashto !== "None" ? <Pill tone="rose">{profile.pashto} Pashto</Pill> : null}
            {profile.plan === "gold" && !profile.hideGoldBadge ? <Pill tone="amber">Gold</Pill> : null}
          </div>
        ) : null}

        {viewerCompat ? (
          <div className="mt-5">
            <CompatibilityPanel compat={viewerCompat} compact />
          </div>
        ) : null}

        <Section title="About Me">
          <div className="flex flex-wrap gap-2">
            {profile.height ? (
              <Pill
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" />
                  </svg>
                }
              >
                {profile.height}
              </Pill>
            ) : null}
            {profile.maritalStatus ? (
              <Pill
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="13" r="5" />
                    <path d="M10 8.5 12 6l2 2.5" />
                  </svg>
                }
              >
                {profile.maritalStatus}
              </Pill>
            ) : null}
            {profile.hasChildren ? (
              <Pill
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="10" r="3.5" />
                    <path d="M8 18c1-1.5 2.2-2.2 4-2.2s3 0.7 4 2.2" />
                  </svg>
                }
              >
                {profile.hasChildren}
              </Pill>
            ) : null}
            {profile.willingChildren ? <Pill>Children: {profile.willingChildren}</Pill> : null}
            {profile.appearance.map((a) => (
              <Pill key={a} tone="rose">
                {a}
              </Pill>
            ))}
          </div>
          {profile.aboutMe ? (
            <p className="mt-4 text-[14px] leading-relaxed text-ink-700 whitespace-pre-line">{profile.aboutMe}</p>
          ) : (
            <p className="mt-3 text-sm text-ink-700/50">No about section yet.</p>
          )}
        </Section>

        {(profile.islamicBackground ||
          profile.islamicPractice ||
          profile.religiousPractice ||
          profile.smoking ||
          profile.vaping ||
          profile.salah) && (
          <Section title="Faith & lifestyle">
            <div className="flex flex-wrap gap-2">
              {profile.islamicBackground ? (
                <Pill tone="amber">
                  <span className="text-amber-500">☪</span> {profile.islamicBackground}
                </Pill>
              ) : null}
              {profile.religiousPractice ? (
                <Pill tone="amber">
                  <span className="text-amber-500">☪</span> {profile.religiousPractice}
                </Pill>
              ) : null}
              {profile.smoking ? <Pill>Smoking: {profile.smoking}</Pill> : null}
              {profile.vaping ? <Pill>Vaping: {profile.vaping}</Pill> : null}
              {profile.salah ? (
                <Pill tone="green">
                  {profile.salah.length > 48 ? `${profile.salah.slice(0, 48)}…` : profile.salah}
                </Pill>
              ) : null}
              {profile.bornMuslim ? <Pill>{profile.bornMuslim}</Pill> : null}
            </div>
            {profile.islamicPractice ? (
              <p className="mt-3 text-[14px] leading-relaxed text-ink-700 whitespace-pre-line">{profile.islamicPractice}</p>
            ) : null}
          </Section>
        )}

        <Section title="Future plans">
          <div className="flex flex-wrap gap-2">
            {profile.relocation ? (
              <Pill>{profile.relocation}</Pill>
            ) : (
              <Pill>Relocation not set</Pill>
            )}
            {profile.ancestralRegion ? <Pill>Roots: {profile.ancestralRegion}</Pill> : null}
          </div>
        </Section>

        {(profile.education || profile.occupation || profile.employment) && (
          <Section title="Work & education">
            <div className="flex flex-wrap gap-2">
              {profile.employment ? <Pill>{profile.employment}</Pill> : null}
              {profile.occupation ? <Pill>{profile.occupation}</Pill> : null}
              {profile.education ? <Pill>{profile.education}</Pill> : null}
            </div>
          </Section>
        )}

        {profile.languages.length > 0 ? (
          <Section title="Languages">
            <div className="flex flex-wrap gap-2">
              {profile.languages.map((l) => (
                <Pill key={l}>{l}</Pill>
              ))}
              {profile.dialect ? <Pill>Speaks {profile.dialect} dialect</Pill> : null}
            </div>
          </Section>
        ) : null}

        {profile.lookingFor ? (
          <Section title="Looking for">
            <div className="rounded-2xl bg-[#f7f4f2] p-4 text-[14px] leading-relaxed text-ink-700 whitespace-pre-line">
              {profile.lookingFor}
            </div>
            {profile.openTo.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.openTo.map((o) => (
                  <Pill key={o} tone="rose">
                    Open to {o}
                  </Pill>
                ))}
              </div>
            ) : null}
          </Section>
        ) : null}

        {profile.interests.length > 0 ? (
          <Section title="Interests">
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((i) => (
                <Pill key={i}>
                  <span aria-hidden>{iconFor(i)}</span> {i}
                </Pill>
              ))}
            </div>
          </Section>
        ) : null}

        {profile.personality.length > 0 ? (
          <Section title="Personality">
            <div className="flex flex-wrap gap-2">
              {profile.personality.map((t) => (
                <Pill key={t}>
                  <span aria-hidden>{iconFor(t)}</span> {t}
                </Pill>
              ))}
            </div>
          </Section>
        ) : null}

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
      {!showMobileChrome || hideNav ? null : (
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
          <MatchActions profileCode={profile.profileCode} initial={matchStatus} layout="fixed" blockedReason={requestBlockedReason} />
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
