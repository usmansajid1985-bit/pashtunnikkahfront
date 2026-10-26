import "flag-icons/css/flag-icons.min.css";
import type { ReactNode } from "react";
import { toCountryCode } from "@/lib/country";
import type { ProfileView } from "@/lib/profile";
import { TribePill } from "@/components/tribe/tribe-pill";
import { ProfilePhotoSlider, type ProfileSlide } from "@/components/profile/profile-photo-slider";
import { BriefcaseIcon, PeopleIcon, PracticeIcon } from "@/components/profile/pill-icons";

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
  photoAction,
  topLeft,
  topRight,
  photoCount = false,
}: {
  profile: ProfileView;
  slides: ProfileSlide[];
  showPhoto: boolean;
  /** No photo may be shown at all (not matched yet) — a placeholder replaces the slider. */
  photoHidden: boolean;
  fallbackSrc: string;
  presence?: { online: boolean; label: string; justJoined?: boolean } | null;
  size?: "phone" | "wide" | "panel";
  /** A control centred on the photo — e.g. chat's "View photo here" when private photos are shared. */
  photoAction?: ReactNode;
  /** Over the photo's top corners — the back arrow and the ⋯ (Report / Block) menu. */
  topLeft?: ReactNode;
  topRight?: ReactNode;
  /** Own profile: show the "1/3" photo-count pill. */
  photoCount?: boolean;
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
        // No photo for this viewer (most often: the member hasn't added one). Show a softly blurred
        // placeholder, never a "hidden" message.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallbackSrc} alt="" className="w-full h-full object-cover blur-xl scale-110" />
      ) : (
        <ProfilePhotoSlider
          slides={slides}
          showPhoto={showPhoto}
          fallbackSrc={fallbackSrc}
          arrows={size !== "phone"}
          countPill={photoCount}
        />
      )}

      {photoAction ? (
        <div className="absolute inset-x-0 top-[28%] -translate-y-1/2 z-20 flex justify-center px-4">{photoAction}</div>
      ) : null}

      {topLeft || topRight ? (
        <div className={`absolute inset-x-0 top-0 z-30 flex items-start justify-between pointer-events-none ${wide ? "p-5" : "p-3.5"}`}>
          <div>{topLeft}</div>
          <div>{topRight}</div>
        </div>
      ) : null}

      {/* Gold members (unless they hide the badge): sunset pill under the back arrow. */}
      {profile.plan === "gold" && !profile.hideGoldBadge ? (
        <span
          className={`absolute z-20 pointer-events-none rounded-full bg-gradient-to-r from-[#f7a8c4] to-[#fcd6a4] font-semibold text-ink-950/75 shadow-sm ${
            topLeft ? (wide ? "top-[4.25rem] left-5 px-4 py-1 text-[13px]" : "top-16 left-3.5 px-3.5 py-1 text-[12.5px]") : "top-3 left-3 px-3.5 py-1 text-[12.5px]"
          }`}
        >
          Gold
        </span>
      ) : null}

      {presence ? (
        <div
          className={`absolute right-3 z-20 pointer-events-none flex flex-col items-end gap-1.5 ${
            topRight ? (wide ? "top-[4.25rem] right-5" : "top-16 right-3.5") : "top-3"
          }`}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3d3836]/85 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#4ade3a]" />
            {presence.label}
          </span>
          {presence.justJoined ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fbd3e3] px-3 py-1.5 text-[12px] font-semibold text-[#e12d72]">
              🎉 Just Joined
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={`absolute inset-x-0 bottom-0 z-10 text-white pointer-events-none ${wide ? "px-8 pb-7" : "px-5 pb-5"}`}>
        <p
          className={`font-bold flex items-baseline gap-2 leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.55),0_2px_12px_rgba(0,0,0,0.45)] ${
            wide ? "text-[34px]" : "text-[26px]"
          }`}
        >
          {profile.profileCode}
          {profile.age ? <span className={`font-medium text-white/90 ${wide ? "text-[26px]" : "text-[21px]"}`}>{profile.age}</span> : null}
        </p>
        <p
          className={`mt-0.5 flex items-center gap-1.5 font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6),0_1px_8px_rgba(0,0,0,0.4)] ${
            wide ? "text-[16px]" : "text-[14px]"
          }`}
        >
          {countryCode ? <span aria-hidden className={`fi fi-${countryCode.toLowerCase()} rounded-[2px]`} /> : null}
          {location || "—"}
        </p>
        {/* Exactly three hero pills: practice, tribe (in its colour), employment. */}
        <div className={`flex flex-wrap ${wide ? "mt-4 gap-2" : "mt-3 gap-1.5"}`}>
          {profile.religiousPractice ? (
            <HeroPill wide={wide} icon={<PracticeIcon practice={profile.religiousPractice} />}>
              {profile.religiousPractice}
            </HeroPill>
          ) : null}
          <TribePill
            tribe={profile.tribe}
            icon={<PeopleIcon />}
            className={`backdrop-blur-md ${wide ? "px-4 py-1.5 text-[13px]" : "px-3 py-1 text-[12px]"}`}
          />
          {profile.employment ? (
            <HeroPill wide={wide} icon={<BriefcaseIcon />}>
              {profile.employment}
            </HeroPill>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Semi-transparent so a little of the photo's colour shows through; icon + text stay solid. */
function HeroPill({ wide, icon, children }: { wide: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-black/30 backdrop-blur-sm font-medium text-white border border-white/25 ${
        wide ? "px-3.5 py-1.5 text-[13px]" : "px-3 py-1 text-[12px]"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}
