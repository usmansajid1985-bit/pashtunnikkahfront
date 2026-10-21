import type { ReactNode } from "react";
import type { ProfileView } from "@/lib/profile";
import { iconFor } from "@/lib/profile-optional";
import { TribePill } from "@/components/tribe/tribe-pill";
import { tribeLabel } from "@/lib/tribes";
import { MEN_APPEARANCE, splitWomenAppearance } from "@/lib/signup";

type Tone = "grey" | "rose" | "blue" | "solid" | "dark";

const TONES: Record<Tone, string> = {
  grey: "bg-[#f3f1f0] text-ink-950",
  rose: "bg-rose-50 text-rose-700",
  blue: "bg-sky-50 text-sky-800",
  solid: "bg-rose-600 text-white",
  dark: "bg-ink-900 text-white",
};

function LangIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M5 6h7M8.5 6c0 6-3 9-5 10M8.5 10c1.2 2.2 3 3.8 5.5 4.6" />
      <path d="M14 18l2.2-5.2L19 18M15 16.2h3" />
    </svg>
  );
}

function BubbleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 16.5 4 20l4.2-1.6A8 8 0 1 0 6 16.5Z" />
    </svg>
  );
}

function MountainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 19 9.2 8.4a1 1 0 0 1 1.7 0L14 13l1.4-2.2a1 1 0 0 1 1.6 0L21 19H3Z" />
    </svg>
  );
}

const APPEARANCE_ART: Record<string, { label: string; image: string }> = {
  "Clean Shaven": { label: "Clean Shaven", image: "/images/signup/beard-clean-shaven.webp" },
  Stubble: { label: "Stubble", image: "/images/signup/beard-stubble.webp" },
  "Short Beard": { label: "Short Beard", image: "/images/signup/beard-short-beard.webp" },
  "Medium Beard": { label: "Medium Beard", image: "/images/signup/beard-medium-beard.webp" },
  "Long Beard": { label: "Long Beard", image: "/images/signup/beard-long-beard.webp" },
  "Does Not Wear Hijab": { label: "No hijab", image: "/images/signup/head-no-hijab.webp" },
  "Wears Hijab": { label: "Wears hijab", image: "/images/signup/head-hijab.webp" },
  "Wears Niqab": { label: "Wears niqab", image: "/images/signup/head-niqab.webp" },
  "Abaya / Jilbab": { label: "Abaya / Jilbab", image: "/images/signup/dress-abaya.webp" },
  "Kamees Partug": { label: "Kamees Partug", image: "/images/signup/dress-kamees-partug.webp" },
  "Western Modest": { label: "Western Modest", image: "/images/signup/dress-western.webp" },
  "Traditional & Western Mix": { label: "Traditional & Western Mix", image: "/images/signup/dress-mix.webp" },
};

function AppearanceChip({ value }: { value: string }) {
  const art = APPEARANCE_ART[value];
  return (
    <Chip
      icon={
        art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art.image} alt="" className="h-5 w-5 object-contain" />
        ) : undefined
      }
    >
      {art?.label ?? value}
    </Chip>
  );
}

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
          {profile.languages.length > 0 || profile.dialect || pashtoLevel ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-700/45">Languages</p>
              <div className={chips}>
                {profile.languages.map((l) => (
                  <Chip key={l} icon={<LangIcon />}>
                    {l === "Pashto" && pashtoLevel ? `Pashto · ${pashtoLevel}` : l}
                  </Chip>
                ))}
                {!profile.languages.includes("Pashto") && pashtoLevel ? (
                  <Chip icon={<LangIcon />}>Pashto · {pashtoLevel}</Chip>
                ) : null}
                {profile.dialect ? (
                  <Chip tone="blue" icon={<BubbleIcon />}>
                    {profile.dialect} dialect
                  </Chip>
                ) : null}
              </div>
            </div>
          ) : null}
          {tribeLabel(profile.tribe) || profile.ancestralRegion || livesIn || profile.relocation ? (
            <div className={profile.languages.length > 0 || profile.dialect || pashtoLevel ? "mt-4 border-t border-ink-900/6 pt-4" : ""}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-700/45">Heritage</p>
              <div className={chips}>
                <TribePill tribe={profile.tribe} />
                {profile.ancestralRegion ? (
                  <Chip tone="dark" icon={<MountainIcon />}>
                    {profile.ancestralRegion.toLowerCase().startsWith("roots")
                      ? profile.ancestralRegion
                      : `Roots in ${profile.ancestralRegion}`}
                  </Chip>
                ) : null}
                {livesIn ? <Chip icon="📍">Lives in {livesIn}</Chip> : null}
                {profile.relocation ? <Chip icon="✈️">{profile.relocation}</Chip> : null}
              </div>
            </div>
          ) : null}
        </Section>
      ) : null}

      {profile.appearance.length > 0 ? (
        <Section title="Appearance">
          {(() => {
            const sister = (profile.gender || "").toLowerCase().startsWith("f");
            const { head, dress } = splitWomenAppearance(profile.appearance);
            const beards = profile.appearance.filter((a) => (MEN_APPEARANCE as readonly string[]).includes(a));
            const known = new Set([head, ...dress, ...beards].filter(Boolean));
            const rest = profile.appearance.filter((a) => !known.has(a));
            if (sister && (head || dress.length)) {
              return (
                <>
                  {head ? (
                    <div className={chips}>
                      <AppearanceChip value={head} />
                    </div>
                  ) : null}
                  {dress.length > 0 ? (
                    <div className={head ? "mt-3" : ""}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-700/45">Dress style</p>
                      <div className={chips}>
                        {dress.map((d) => (
                          <AppearanceChip key={d} value={d} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {rest.length > 0 ? (
                    <div className={`${chips} mt-2`}>
                      {rest.map((a) => (
                        <AppearanceChip key={a} value={a} />
                      ))}
                    </div>
                  ) : null}
                </>
              );
            }
            const shown = beards.length > 0 ? [...beards, ...rest] : profile.appearance;
            return (
              <>
                {beards.length > 0 ? (
                  <p className="mb-2 text-[11px] font-semibold text-ink-700/45">Facial hair</p>
                ) : null}
                <div className={chips}>
                  {shown.map((a) => (
                    <AppearanceChip key={a} value={a} />
                  ))}
                </div>
              </>
            );
          })()}
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
