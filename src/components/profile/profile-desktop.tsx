import Link from "next/link";
import type { ReactNode } from "react";
import type { ProfileView } from "@/lib/profile";
import { BrowseAppNav } from "@/components/browse/app-nav";

function DetailRow({
  label,
  value,
  iconBg,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  iconBg?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="detail-row">
      <span className="flex items-center gap-3 text-sm text-ink-900">
        {icon ? (
          <span className="icon-badge" style={{ background: iconBg || "#f3f1f0" }}>
            {icon}
          </span>
        ) : null}
        {label}
      </span>
      <span className="text-sm font-medium text-ink-950 text-right max-w-[55%]">{value || "—"}</span>
    </div>
  );
}

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
  viewerCompat?: { score: number; reasons: string[] } | null;
  /** Real presence for the member being viewed — one source of truth with Browse. */
  presence?: { online: boolean; label: string } | null;
}) {
  const isOwn = showEditTab;
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const avatarSrc =
    photoOverrideUrl !== undefined ? photoOverrideUrl : profile.photoUrl;
  const avatar = avatarSrc || `https://i.pravatar.cc/240?img=${(profile.avatarSeed % 70) + 1}`;
  const photoVisible =
    photoOverrideVisible !== undefined ? photoOverrideVisible : profile.photoStatus === "approved";

  return (
    <div className={embedded ? "text-ink-900" : `min-h-screen bg-[#faf8f7] text-ink-900 ${hideNav ? "" : "lg:pl-60"}`}>
      {hideNav || embedded ? null : (
        <BrowseAppNav
          profileCode={navProfileCode ?? (isOwn ? profile.profileCode : null)}
          active={isOwn ? "profile" : "browse"}
          unreadCount={unreadCount}
        />
      )}

      <main className={embedded ? "px-4 sm:px-6 py-6" : "max-w-7xl mx-auto px-5 sm:px-8 py-8"}>
        {showEditTab ? (
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex gap-8 text-[15px]">
              <span className="pb-2 font-bold text-ink-950 border-b-[3px] border-rose-600">Preview</span>
              <Link href="/profile/edit" className="pb-2 font-medium text-ink-700/50 hover:text-ink-900">
                Edit
              </Link>
            </div>
            <Link
              href="/profile/edit"
              className="px-5 py-2.5 rounded-full bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
            >
              Edit profile
            </Link>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">Member profile</p>
            <h1 className="mt-1 text-2xl font-bold text-ink-950">{profile.profileCode}</h1>
          </div>
        )}

        <div className={embedded ? "space-y-6" : "grid lg:grid-cols-2 gap-6 items-start"}>
          {/* Left */}
          <div className="space-y-6">
            <div className="card p-6" style={{ background: "linear-gradient(180deg,#fdf6f3,#ffffff)" }}>
              <div className="flex items-start gap-5">
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar}
                    alt=""
                    className="w-24 h-24 rounded-2xl object-cover"
                    style={photoVisible ? undefined : { filter: "blur(8px) saturate(0.85)" }}
                  />
                  {!isOwn && presence ? (
                    <span
                      className={`absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-ink-900/8 text-[11px] font-semibold shadow-sm ${
                        presence.online ? "text-green-600" : "text-ink-700/60"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          presence.online ? "bg-green-500" : "bg-ink-700/40"
                        }`}
                      />
                      {presence.label}
                    </span>
                  ) : null}
                </div>
                <div className="pt-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h1 className="text-xl font-bold text-ink-950">{profile.profileCode}</h1>
                    {profile.verified ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="#2563eb">
                        <path d="M12 2l2.4 1.4 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L22 12l-1.4 2.4.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 22l-2.4-1.4-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2 12l1.4-2.4-.3-2.8 2.5-1.2 1.2-2.5 2.8.3Z" />
                      </svg>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-ink-950">{profile.fullName}</p>
                  <p className="mt-1 text-sm text-ink-700">
                    {[profile.age ? `${profile.age} years` : null, location].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.maritalStatus ? (
                      <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-semibold">
                        {profile.maritalStatus}
                      </span>
                    ) : null}
                    {profile.pashto ? (
                      <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-semibold">
                        {profile.pashto} Pashto
                      </span>
                    ) : null}
                    {profile.plan === "gold" && !profile.hideGoldBadge ? (
                      <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
                        Gold
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-4 rounded-2xl bg-white border border-ink-900/8 divide-x divide-ink-900/8 overflow-hidden">
                {[
                  { label: "Height", value: profile.height },
                  { label: "Weight", value: profile.weight },
                  { label: "Build", value: profile.build },
                  { label: "Marital", value: profile.maritalStatus },
                ].map((s) => (
                  <div key={s.label} className="p-3 text-center">
                    <p className="text-[11px] text-ink-700/60">{s.label}</p>
                    <p className="text-sm font-semibold text-ink-950 mt-1 line-clamp-2">{s.value || "—"}</p>
                  </div>
                ))}
              </div>
            </div>

            {viewerCompat ? (
              <div className="card p-6 border border-rose-100 bg-rose-50/30">
                <h2 className="font-bold text-ink-950">Why you match</h2>
                <p className="mt-1 text-2xl font-bold text-rose-700">{viewerCompat.score}% compatible</p>
                {viewerCompat.reasons.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-sm text-ink-700 leading-relaxed">
                    {viewerCompat.reasons.map((reason) => (
                      <li key={reason} className="flex gap-2">
                        <span className="text-rose-500 shrink-0">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-700/55 italic">
                    AI explanation will appear after the first compatibility analysis.
                  </p>
                )}
              </div>
            ) : null}

            <div className="card p-6">
              <h2 className="font-bold text-ink-950">About Me</h2>
              <div className="mt-4 space-y-3 text-sm text-ink-700 leading-relaxed whitespace-pre-line">
                {profile.aboutMe || "No about section yet."}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-bold text-ink-950 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aa1945" strokeWidth="1.8">
                  <path d="M12 21s-7-4.35-9-8.5C1.4 9 3 5.5 6.5 5.5c2 0 3.7 1.2 5.5 3.3 1.8-2.1 3.5-3.3 5.5-3.3 3.5 0 5.1 3.5 3.5 7C19 16.65 12 21 12 21Z" />
                </svg>
                I&apos;m Looking For
              </h2>
              <div className="mt-4 text-sm leading-relaxed whitespace-pre-line" style={{ color: "#b5651d" }}>
                {profile.lookingFor || "Preferences not added yet."}
              </div>
              {profile.openTo.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.openTo.map((o) => (
                    <span key={o} className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-xs font-semibold">
                      Open to {o}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-6">
            {isOwn ? (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-ink-950">Profile Completeness</h2>
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
              <div className="mt-5 space-y-0.5">
                {profile.checklist.map((c) => (
                  <div key={c.label} className="detail-row">
                    <span className="flex items-center gap-2.5 text-sm text-ink-900">
                      {c.done ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2">
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      )}
                      {c.label}
                    </span>
                    {!c.done && showEditTab && c.action === "edit" ? (
                      <Link href="/profile/edit" className="text-xs font-semibold" style={{ color: "#c8952b" }}>
                        Complete
                      </Link>
                    ) : null}
                    {!c.done && c.action === "review" ? (
                      <span className="text-xs font-semibold text-ink-700/50">Pending review</span>
                    ) : null}
                    {c.done && c.action === "review" ? (
                      <span className="text-xs font-semibold text-emerald-700">Verified</span>
                    ) : null}
                  </div>
                ))}
              </div>
              {!profile.culturalVerified ? (
                <p className="mt-4 text-[12px] text-ink-700/60 leading-relaxed">
                  Cultural verification is confirmed by the PN team (Pashtun / community authenticity). Filling
                  your profile does not flip this automatically — it does not reduce your completeness %.
                </p>
              ) : null}
              {showEditTab ? (
                <Link
                  href="/profile/edit"
                  className="mt-5 block text-center py-3 rounded-full text-white font-semibold text-sm"
                  style={{ background: "linear-gradient(135deg,#aa1945,#d14f82)" }}
                >
                  Complete my profile
                </Link>
              ) : null}
            </div>
            ) : footer ? (
              <div className="card p-6">
                <h2 className="font-bold text-ink-950 mb-3">Connect</h2>
                {footer}
              </div>
            ) : null}

            <div className="card p-6">
              <h2 className="font-bold text-ink-950 mb-1">Quick Facts</h2>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: "Religious Practice", value: profile.religiousPractice },
                  { label: "Pashto Ability", value: profile.pashto },
                  { label: "Ancestral Region", value: profile.ancestralRegion },
                  { label: "Tribe", value: profile.tribe },
                  { label: "Relocation", value: profile.relocation },
                  { label: "Location", value: location },
                ].map((f) => (
                  <div key={f.label} className="rounded-xl bg-[#faf8f7] border border-ink-900/6 px-3 py-3">
                    <p className="text-[11px] text-ink-700/55 font-semibold uppercase tracking-wide">{f.label}</p>
                    <p className="mt-1 text-sm font-semibold text-ink-950">{f.value || "—"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-bold text-ink-950">Details</h2>
              <div className="mt-3">
                <DetailRow label="Age" value={profile.age != null ? `${profile.age} years` : null} />
                <DetailRow label="Height" value={profile.height} />
                <DetailRow label="Appearance" value={profile.appearance.join(", ") || null} />
                <DetailRow label="Children" value={profile.hasChildren} />
                <DetailRow label="Willing children" value={profile.willingChildren} />
                <DetailRow label="Tribe / Clan" value={profile.tribe} />
                <DetailRow label="Ethnicity" value={profile.ethnicity} />
                <DetailRow label="Country" value={profile.country} />
                <DetailRow label="City" value={profile.city} />
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-bold text-ink-950 flex items-center gap-2">Faith</h2>
              <div className="mt-2">
                <DetailRow label="Islamic Background" value={profile.islamicBackground} />
                <DetailRow label="Religious Practice" value={profile.religiousPractice} />
                <DetailRow label="Smoking" value={profile.smoking} />
                <DetailRow label="Vaping" value={profile.vaping} />
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-bold text-ink-950">Work &amp; Education</h2>
              <div className="mt-2">
                <DetailRow label="Employment" value={profile.employment} />
                <DetailRow label="Profession" value={profile.occupation} />
                <DetailRow label="Education" value={profile.education} />
                <DetailRow label="Languages" value={profile.languages.join(", ") || null} />
              </div>
            </div>
          </div>
        </div>

        {embedded ? null : (
          <div className="mt-6 card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="flex items-center gap-2.5 text-sm text-ink-700 text-center sm:text-left">
              <svg className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8">
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <span>
                {isOwn ? (
                  <>
                    <strong className="text-ink-950">Your contact information is never shared publicly.</strong> It is
                    kept secure and only used for verification.
                  </>
                ) : (
                  <>
                    <strong className="text-ink-950">Contact details stay private.</strong> Send a match request to start
                    a conversation.
                  </>
                )}
              </span>
            </p>
            <Link
              href={backHref}
              className="shrink-0 px-5 py-2.5 rounded-full border border-ink-900/12 text-sm font-semibold hover:border-rose-300"
            >
              {backLabel}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
