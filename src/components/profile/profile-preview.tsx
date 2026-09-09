import type { ProfileView } from "@/lib/profile";
import type { ReactNode } from "react";
import { ProfileDesktop } from "@/components/profile/profile-desktop";
import { MatchActions } from "@/components/matches/match-actions";
import type { MatchRelationStatus } from "@/lib/matches";

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
  navProfileCode,
  hideNav = false,
  backHref,
  backLabel,
  unreadCount = 0,
  viewerCompat,
  presence,
}: {
  profile: ProfileView;
  showEditTab?: boolean;
  closeHref?: string;
  matchStatus?: MatchRelationStatus;
  navProfileCode?: string | null;
  /** Omit the site nav — used for restricted viewers (e.g. wali) who shouldn't see Browse/Chats/Settings links */
  hideNav?: boolean;
  backHref?: string;
  backLabel?: string;
  unreadCount?: number;
  /** Gold viewer compatibility breakdown for the profile being viewed */
  viewerCompat?: { score: number; reasons: string[] } | null;
  /** Real presence for the member being viewed — one source of truth with Browse. */
  presence?: { online: boolean; label: string } | null;
}) {
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const avatar = profile.photoUrl || `https://i.pravatar.cc/240?img=${(profile.avatarSeed % 70) + 1}`;

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
          footer={
            matchStatus ? (
              <MatchActions profileCode={profile.profileCode} initial={matchStatus} layout="inline" />
            ) : null
          }
        />
      </div>

      {/* Mobile — phone-style pill preview */}
      <div className="lg:hidden bg-white min-h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-900/6">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <a
            href={closeHref}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ink-900/5"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
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

      <div className="max-w-lg mx-auto px-4 pb-28">
        {/* Hero identity */}
        <div className="pt-5 flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar}
            alt=""
            className="w-[88px] h-[88px] rounded-[22px] object-cover shrink-0"
            style={
              profile.photoStatus === "approved"
                ? undefined
                : { filter: "blur(8px) saturate(0.85)" }
            }
          />
          <div className="pt-1 min-w-0">
            <p className="text-xs font-bold tracking-wide text-rose-600 uppercase">{profile.profileCode}</p>
            <h1 className="text-xl font-bold text-ink-950 mt-0.5 truncate">{profile.fullName}</h1>
            <p className="text-sm text-ink-700/70 mt-1">
              {[profile.age ? `${profile.age} years` : null, location].filter(Boolean).join(" · ") || "—"}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {presence ? (
                <Pill tone={presence.online ? "green" : "grey"}>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      presence.online ? "bg-emerald-500" : "bg-ink-700/40"
                    }`}
                  />
                  {presence.label}
                </Pill>
              ) : null}
              {profile.maritalStatus ? <Pill tone="rose">{profile.maritalStatus}</Pill> : null}
              {profile.pashto ? <Pill tone="rose">{profile.pashto} Pashto</Pill> : null}
              {profile.plan === "gold" && !profile.hideGoldBadge ? <Pill tone="amber">Gold</Pill> : null}
            </div>
          </div>
        </div>

        {viewerCompat ? (
          <section className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Your compatibility</p>
            <p className="mt-1 text-xl font-bold text-ink-950">{viewerCompat.score}% match</p>
            {viewerCompat.reasons.length > 0 ? (
              <ul className="mt-2.5 space-y-1.5 text-sm text-ink-700/85 leading-relaxed">
                {viewerCompat.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className="text-rose-500 shrink-0">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-ink-700/55 italic">Detailed reasons appear after AI analysis.</p>
            )}
          </section>
        ) : null}

        {/* Quick facts 6 */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Practice", value: profile.religiousPractice },
            { label: "Pashto", value: profile.pashto },
            { label: "Ancestral", value: profile.ancestralRegion },
            { label: "Tribe", value: profile.tribe },
            { label: "Relocation", value: profile.relocation },
            { label: "Location", value: profile.city || profile.country },
          ].map((f) => (
            <div key={f.label} className="rounded-2xl bg-[#f7f4f2] px-2.5 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-700/50">{f.label}</p>
              <p className="mt-1 text-[12px] font-semibold text-ink-950 leading-snug line-clamp-2">
                {f.value || "—"}
              </p>
            </div>
          ))}
        </div>

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
              {profile.dialect ? <Pill>Dialect: {profile.dialect}</Pill> : null}
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
                <Pill key={i}>{i}</Pill>
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
      {showEditTab ? (
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 lg:hidden">
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
          <MatchActions profileCode={profile.profileCode} initial={matchStatus} layout="fixed" />
        </div>
      ) : (
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-6 lg:hidden">
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
