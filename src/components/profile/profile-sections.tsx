import type { ReactNode } from "react";
import type { ProfileView } from "@/lib/profile";
import { iconFor } from "@/lib/profile-optional";
import { TribePill } from "@/components/tribe/tribe-pill";
import { tribeLabel } from "@/lib/tribes";

type Tone = "grey" | "rose" | "blue" | "solid" | "dark";

const TONES: Record<Tone, string> = {
  grey: "bg-[#f3f1f0] text-ink-950",
  rose: "bg-rose-50 text-rose-700",
  blue: "bg-sky-50 text-sky-800",
  solid: "bg-rose-600 text-white",
  dark: "bg-ink-900 text-white",
};

function Chip({ icon, tone = "grey", children }: { icon?: ReactNode; tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${TONES[tone]}`}>
      {icon ? <span aria-hidden className="shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

/**
 * The body of a member profile, in one fixed order on every screen: About Me, I'm Looking For,
 * Career & Education, Faith & Lifestyle, Heritage & Languages, Interests, Personality. A section
 * with nothing to show is left out. `card` wraps each section in a card (desktop).
 *
 * The order and grouping are the design; the CONTENT rule is that every detail a member has
 * filled in appears somewhere here — don't drop a field because a mock-up didn't happen to show it.
 */
export function ProfileSections({ profile, card = false }: { profile: ProfileView; card?: boolean }) {
  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className={card ? "card p-6" : "mt-7"}>
      <h2 className={card ? "text-lg font-bold text-ink-950 mb-3" : "text-[20px] font-bold text-ink-950 mb-3"}>{title}</h2>
      {children}
    </section>
  );
  // A profile loaded by an older page (cached before these fields existed) may lack the arrays.
  const interests = profile.interests ?? [];
  const personality = profile.personality ?? [];
  const chips = "flex flex-wrap gap-2";
  const text = "mt-3 text-[14px] leading-relaxed text-ink-700 whitespace-pre-line";

  const pashtoLevel = profile.pashto && profile.pashto !== "None" ? profile.pashto : null;
  const smoking = profile.smoking ? (profile.smoking === "Never" ? "Non-smoker" : `Smokes ${profile.smoking.toLowerCase()}`) : null;
  const vaping = profile.vaping ? (profile.vaping === "Never" ? "Doesn't vape" : `Vapes ${profile.vaping.toLowerCase()}`) : null;
  const hasCareer = profile.education || profile.employment || profile.occupation;
  const hasFaith =
    profile.islamicBackground || profile.religiousPractice || profile.salah || smoking || vaping || profile.bornMuslim || profile.islamicPractice;
  const livesIn = [profile.city, profile.country].filter(Boolean).join(", ");
  const hasHeritage =
    profile.languages.length > 0 || profile.dialect || pashtoLevel || tribeLabel(profile.tribe) || profile.ancestralRegion || livesIn || profile.relocation;

  return (
    <>
      <Section title="About Me">
        <div className={chips}>
          {profile.age != null ? <Chip>{profile.age} years</Chip> : null}
          {profile.height ? <Chip icon="↕">{profile.height}</Chip> : null}
          {profile.weight ? <Chip>Weight: {profile.weight}</Chip> : null}
          {profile.build ? <Chip>Build: {profile.build}</Chip> : null}
          {profile.maritalStatus ? <Chip icon="💍">{profile.maritalStatus}</Chip> : null}
          {profile.hasChildren ? <Chip icon="👶">{profile.hasChildren}</Chip> : null}
          {profile.willingChildren ? <Chip icon="🍼">Children: {profile.willingChildren}</Chip> : null}
          {profile.appearance.map((a) => (
            <Chip key={a} tone="rose">
              {a}
            </Chip>
          ))}
        </div>
        {profile.aboutMe ? <p className={text}>{profile.aboutMe}</p> : <p className="mt-3 text-sm text-ink-700/50">No about section yet.</p>}
      </Section>

      <Section title="I'm Looking For">
        {profile.lookingFor ? (
          <p className={text.replace("mt-3 ", "")}>{profile.lookingFor}</p>
        ) : (
          <p className="text-sm text-ink-700/50">Preferences not added yet.</p>
        )}
        {profile.openTo.length ? (
          <div className={`${chips} mt-3`}>
            {profile.openTo.map((o) => (
              <Chip key={o} tone="rose">
                Open to {o}
              </Chip>
            ))}
          </div>
        ) : null}
      </Section>

      {hasCareer ? (
        <Section title="Career & Education">
          <div className={chips}>
            {profile.education ? <Chip icon="🎓">{profile.education}</Chip> : null}
            {profile.occupation ? <Chip icon="💼">{profile.occupation}</Chip> : null}
            {profile.employment && profile.employment !== profile.occupation ? <Chip icon="🧑‍💻">{profile.employment}</Chip> : null}
          </div>
        </Section>
      ) : null}

      {hasFaith ? (
        <Section title="Faith & Lifestyle">
          <div className={chips}>
            {profile.islamicBackground ? <Chip icon="☪">{profile.islamicBackground}</Chip> : null}
            {smoking ? <Chip icon="🚭">{smoking}</Chip> : null}
            {vaping ? <Chip icon="💨">{vaping}</Chip> : null}
            {/* B08: members can filter by Salah, so it must be visible on the profile. */}
            {profile.salah ? <Chip icon="🕌">{profile.salah}</Chip> : null}
            {profile.religiousPractice ? <Chip>{profile.religiousPractice}</Chip> : null}
            {profile.bornMuslim ? <Chip>{profile.bornMuslim}</Chip> : null}
          </div>
          {profile.islamicPractice ? <p className={text}>{profile.islamicPractice}</p> : null}
        </Section>
      ) : null}

      {hasHeritage ? (
        <Section title="Heritage & Languages">
          <div className={chips}>
            {profile.languages.map((l) => (
              <Chip key={l} icon="🗣️">
                {l}
              </Chip>
            ))}
            {profile.dialect ? (
              <Chip tone="blue" icon="💬">
                Speaks {profile.dialect} dialect
              </Chip>
            ) : null}
            {pashtoLevel ? (
              <Chip tone="rose" icon="💬">
                Pashto proficiency: {pashtoLevel}
              </Chip>
            ) : null}
            <TribePill tribe={profile.tribe} />
            {profile.ancestralRegion ? (
              <Chip tone="dark" icon="⛰️">
                {profile.ancestralRegion}
              </Chip>
            ) : null}
            {livesIn ? <Chip icon="📍">Lives in {livesIn}</Chip> : null}
            {profile.relocation ? <Chip icon="✈️">{profile.relocation}</Chip> : null}
          </div>
        </Section>
      ) : null}

      {interests.length > 0 ? (
        <Section title="Interests">
          <div className={chips}>
            {interests.map((i) => (
              <Chip key={i} icon={iconFor(i)}>
                {i}
              </Chip>
            ))}
          </div>
        </Section>
      ) : null}

      {personality.length > 0 ? (
        <Section title="Personality">
          <div className={chips}>
            {personality.map((t) => (
              <Chip key={t} icon={iconFor(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
