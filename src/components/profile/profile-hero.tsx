import "flag-icons/css/flag-icons.min.css";
import { toCountryCode } from "@/lib/country";
import type { ProfileView } from "@/lib/profile";
import { TribePill } from "@/components/tribe/tribe-pill";
import { ProfilePhotoSlider, type ProfileSlide } from "@/components/profile/profile-photo-slider";

/**
 * The photo-led top of a member profile: photo(s) with the profile ID, age, location and headline
 * chips laid over it. One design on every screen — `size` only changes the proportions: a tall
 * portrait on phones, a wide banner on desktop, something in between inside the chat's Profile tab.
 */
export function ProfileHero({
  profile,
  slides,
  showPhoto,
  photoHidden,
  fallbackSrc,
  presence,
  size = "phone",
}: {
  profile: ProfileView;
  slides: ProfileSlide[];
  showPhoto: boolean;
  /** No photo may be shown at all (not matched yet) — a placeholder replaces the slider. */
  photoHidden: boolean;
  fallbackSrc: string;
  presence?: { online: boolean; label: string; justJoined?: boolean } | null;
  size?: "phone" | "wide" | "panel";
}) {
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const countryCode = toCountryCode(profile.country);
  const wide = size === "wide";
  const frame =
    size === "wide"
      ? "aspect-[16/9] max-h-[540px] rounded-3xl"
      : size === "panel"
        ? "aspect-[4/3] max-h-[440px] rounded-2xl"
        : "aspect-[4/5]";

  return (
    <div className={`relative w-full overflow-hidden bg-ink-900/10 ${frame}`}>
      {photoHidden ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ink-900/10 to-ink-900/5">
          <p className="text-sm font-semibold text-ink-700/50 px-10 text-center">Photo hidden until you match</p>
        </div>
      ) : (
        <ProfilePhotoSlider slides={slides} showPhoto={showPhoto} fallbackSrc={fallbackSrc} arrows={size !== "phone"} />
      )}

      {presence ? (
        <div className="absolute top-4 right-4 z-20 pointer-events-none flex flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold backdrop-blur-md ${
              presence.online ? "bg-emerald-500/90 text-white" : "bg-black/40 text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${presence.online ? "bg-white" : "bg-white/60"}`} />
            {presence.label}
          </span>
          {presence.justJoined ? (
            <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-[12px] font-semibold bg-amber-400/90 text-ink-950 backdrop-blur-md">
              ✨ Just Joined
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none"
        aria-hidden
      />

      <div className={`absolute inset-x-0 bottom-0 z-10 text-white pointer-events-none ${wide ? "px-8 pb-7" : "px-5 pb-5"}`}>
        <p
          className={`font-bold flex items-baseline gap-2 leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.4)] ${
            wide ? "text-[34px]" : "text-[22px]"
          }`}
        >
          {wide ? profile.profileCode : `${profile.profileCode}${profile.age ? `, ${profile.age}` : ""}`}
          {wide && profile.age ? <span className="text-[26px] font-medium text-white/90">{profile.age}</span> : null}
          {profile.verified ? (
            <svg width={wide ? 22 : 16} height={wide ? 22 : 16} viewBox="0 0 24 24" fill="#60a5fa" className="shrink-0 self-center">
              <path d="M12 2l2.4 1.4 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8L22 12l-1.4 2.4.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 22l-2.4-1.4-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2 12l1.4-2.4-.3-2.8 2.5-1.2 1.2-2.5 2.8.3Z" />
            </svg>
          ) : null}
        </p>
        <p
          className={`mt-0.5 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-white/85 ${
            wide ? "text-[14px]" : "text-[13px]"
          }`}
        >
          {countryCode ? <span aria-hidden className={`fi fi-${countryCode.toLowerCase()} rounded-[2px]`} /> : null}
          {location || "—"}
        </p>
        <div className={`flex flex-wrap ${wide ? "mt-4 gap-2" : "mt-3 gap-1.5"}`}>
          {[profile.occupation, profile.religiousPractice, profile.ancestralRegion, profile.relocation]
            .filter((v): v is string => Boolean(v))
            .map((v, i) => (
              <span
                key={`${v}-${i}`}
                className={`rounded-full bg-white/15 backdrop-blur-md font-medium text-white border border-white/20 ${
                  wide ? "px-3.5 py-1.5 text-[13px]" : "px-2.5 py-1 text-[11.5px]"
                }`}
              >
                {v}
              </span>
            ))}
          <TribePill tribe={profile.tribe} className={wide ? "px-4 py-1.5 text-[13px]" : "px-3 py-1 text-[11.5px]"} />
        </div>
      </div>
    </div>
  );
}
