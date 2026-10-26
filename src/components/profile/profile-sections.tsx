import type { ReactNode } from "react";
import type { ProfileView } from "@/lib/profile";
import { iconFor } from "@/lib/profile-optional";
import { TribePill } from "@/components/tribe/tribe-pill";
import { tribeLabel } from "@/lib/tribes";
import { MEN_APPEARANCE, splitWomenAppearance } from "@/lib/signup";
import { RelocationIcon } from "@/components/profile/pill-icons";

type Tone = "grey" | "rose" | "blue" | "solid" | "dark";

const TONES: Record<Tone, string> = {
  grey: "bg-[#f5f4f3] border-ink-900/[0.06] text-ink-950",
  rose: "bg-rose-50 border-rose-100 text-rose-700",
  blue: "bg-sky-50 border-sky-100 text-sky-700",
  solid: "bg-rose-600 border-rose-600 text-white",
  dark: "bg-ink-950 border-ink-950 text-white",
};

function LangIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M5 6h7M8.5 6c0 6-3 9-5 10M8.5 10c1.2 2.2 3 3.8 5.5 4.6" />
      <path d="M14 18l2.2-5.2L19 18M15 16.2h3" />
    </svg>
  );
}

function BubbleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 16.5 4 20l4.2-1.6A8 8 0 1 0 6 16.5Z" />
    </svg>
  );
}

/** Hollow white mountain for the black "Roots in …" pill. */
function MountainIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 19 9.2 7.6a1 1 0 0 1 1.7 0L17 18" />
      <path d="m13.4 12.2 1.6-2.4a1 1 0 0 1 1.7 0L21.5 19H2.5" />
    </svg>
  );
}

function HeightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <path d="M12 4v16M8.5 4h7M8.5 20h7" />
    </svg>
  );
}

/** Profile wording (spec): short, plain labels for the stored answers. */
function childrenLabel(v: string | null) {
  if (!v) return null;
  if (v === "No Children") return "Doesn't have children";
  if (v === "Have Children") return "Has children";
  return v;
}
function wantsChildrenLabel(v: string | null) {
  if (!v) return null;
  if (v === "Yes" || v.startsWith("Insha")) return "Wants children";
  if (v === "No") return "Doesn't want children";
  return v;
}
function salahLabel(v: string | null) {
  if (!v) return null;
  const head = v.split("–")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    consistently: "Prays 5 daily prayers",
    "almost always": "Almost always prays",
    regularly: "Prays regularly",
    sometimes: "Prays sometimes",
    rarely: "Rarely prays",
    "never / one-offs": "Doesn't currently pray",
  };
  return map[head] ?? v.split("–")[0].trim();
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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${TONES[tone]}`}>
      {icon ? <span aria-hidden className="shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

/**
 * The body of a member profile, in one fixed order on every screen: About Me, I'm Looking For,
 * Career & Education, Faith & Lifestyle, Appearance, Heritage & Languages, Interests, Personality.
 * Each section is its own white card; a section with nothing to show is left out.
 *
 * The order and grouping are the design; the CONTENT rule is that every detail a member has
 * filled in appears somewhere here — don't drop a field because a mock-up didn't happen to show it.
 * (Employment is the third hero pill, so it isn't repeated under Career.)
 */
export function ProfileSections({ profile }: { profile: ProfileView; card?: boolean }) {
  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="rounded-2xl bg-white border border-ink-900/[0.06] shadow-[0_1px_2px_rgba(15,13,14,0.03)] p-4 sm:p-5 lg:p-6">
      <h2 className="text-[18px] lg:text-[19px] font-bold text-ink-950 mb-3">{title}</h2>
      {children}
    </section>
  );
  const Group = ({ label, first = false, children }: { label: string; first?: boolean; children: ReactNode }) => (
    <div className={first ? "" : "mt-4 pt-4 border-t border-ink-900/[0.06]"}>
      <div className="sm:grid sm:grid-cols-[150px_1fr] sm:items-start sm:gap-3">
        <p className="mb-2 sm:mb-0 sm:pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-700/50">{label}</p>
        <div>{children}</div>
      </div>
    </div>
  );
  // A profile loaded by an older page (cached before these fields existed) may lack the arrays.
  const interests = profile.interests ?? [];
  const personality = profile.personality ?? [];
  const chips = "flex flex-wrap gap-2";
  const text = "text-[14px] leading-relaxed text-ink-700 whitespace-pre-line";

  const pashtoLevel = profile.pashto && profile.pashto !== "None" ? profile.pashto : null;
  const smoking = profile.smoking ? (profile.smoking === "Never" ? "Non-smoker" : `Smokes ${profile.smoking.toLowerCase()}`) : null;
  const vaping = profile.vaping ? (profile.vaping === "Never" ? "Doesn't vape" : `Vapes ${profile.vaping.toLowerCase()}`) : null;
  const hasChildren = childrenLabel(profile.hasChildren);
  const wantsChildren = wantsChildrenLabel(profile.willingChildren);
  const salah = salahLabel(profile.salah);
  const hasCareer = profile.education || profile.occupation || (profile.employment && !profile.occupation);
  const hasFaithPractice = profile.islamicBackground || profile.religiousPractice || salah || profile.bornMuslim;
  const hasLifestyle = smoking || vaping;
  const hasFaith = hasFaithPractice || hasLifestyle || profile.islamicPractice;
  const hasLanguages = profile.languages.length > 0 || profile.dialect || pashtoLevel;
  const hasHeritageGroup = tribeLabel(profile.tribe) || profile.ancestralRegion || profile.relocation;

  return (
    <>
      <Section title="About Me">
        <div className={chips}>
          {profile.height ? <Chip icon={<HeightIcon />}>{profile.height}</Chip> : null}
          {profile.maritalStatus ? <Chip icon="💍">{profile.maritalStatus}</Chip> : null}
          {hasChildren ? <Chip icon="👶">{hasChildren}</Chip> : null}
          {wantsChildren ? <Chip icon="🍼">{wantsChildren}</Chip> : null}
          {profile.weight ? <Chip>Weight: {profile.weight}</Chip> : null}
          {profile.build ? <Chip>Build: {profile.build}</Chip> : null}
        </div>
        {profile.aboutMe ? <p className={`mt-3 ${text}`}>{profile.aboutMe}</p> : <p className="mt-3 text-sm text-ink-700/50">No about section yet.</p>}
      </Section>

      <Section title="I'm Looking For">
        {profile.lookingFor ? <p className={text}>{profile.lookingFor}</p> : <p className="text-sm text-ink-700/50">Preferences not added yet.</p>}
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
            {!profile.occupation && profile.employment ? <Chip icon="💼">{profile.employment}</Chip> : null}
          </div>
        </Section>
      ) : null}

      {hasFaith ? (
        <Section title="Faith & Lifestyle">
          {hasFaithPractice ? (
            <Group label="Faith & Practice" first>
              <div className={chips}>
                {profile.islamicBackground ? <Chip icon="☪️">{profile.islamicBackground}</Chip> : null}
                {/* B08: members can filter by Salah, so it must be visible on the profile. */}
                {salah ? <Chip icon="🕌">{salah}</Chip> : null}
                {profile.religiousPractice ? <Chip>{profile.religiousPractice}</Chip> : null}
                {profile.bornMuslim ? <Chip>{profile.bornMuslim}</Chip> : null}
              </div>
            </Group>
          ) : null}
          {hasLifestyle ? (
            <Group label="Lifestyle" first={!hasFaithPractice}>
              <div className={chips}>
                {smoking ? <Chip icon="🚭">{smoking}</Chip> : null}
                {vaping ? <Chip icon="💨">{vaping}</Chip> : null}
              </div>
            </Group>
          ) : null}
          {profile.islamicPractice ? (
            <div className={hasFaithPractice || hasLifestyle ? "mt-4 pt-4 border-t border-ink-900/[0.06]" : ""}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-700/50">My Islamic Practice</p>
              <p className={text}>{profile.islamicPractice}</p>
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
            const label = "mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-700/50";
            if (sister && (head || dress.length)) {
              return (
                <>
                  {head ? (
                    <div>
                      <p className={label}>Head covering</p>
                      <div className={chips}>
                        <AppearanceChip value={head} />
                      </div>
                    </div>
                  ) : null}
                  {dress.length > 0 ? (
                    <div className={head ? "mt-4" : ""}>
                      <p className={label}>Dress style</p>
                      <div className={chips}>
                        {dress.map((d) => (
                          <AppearanceChip key={d} value={d} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {rest.length > 0 ? (
                    <div className={`${chips} mt-3`}>
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
                {beards.length > 0 ? <p className={label}>Facial hair</p> : null}
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

      {hasLanguages || hasHeritageGroup ? (
        <Section title="Heritage & Languages">
          {hasLanguages ? (
            <Group label="Languages" first>
              <div className={chips}>
                {profile.languages.map((l) => (
                  <Chip key={l} icon={<LangIcon />}>
                    {l === "Pashto" && pashtoLevel ? `Pashto · ${pashtoLevel}` : l}
                  </Chip>
                ))}
                {!profile.languages.includes("Pashto") && pashtoLevel ? <Chip icon={<LangIcon />}>Pashto · {pashtoLevel}</Chip> : null}
                {profile.dialect ? (
                  <Chip tone="blue" icon={<BubbleIcon />}>
                    {profile.dialect} dialect
                  </Chip>
                ) : null}
              </div>
            </Group>
          ) : null}
          {hasHeritageGroup ? (
            <Group label="Heritage" first={!hasLanguages}>
              <div className={chips}>
                <TribePill tribe={profile.tribe} className="px-3.5 py-1.5 text-[13px]" />
                {profile.ancestralRegion ? (
                  <Chip tone="dark" icon={<MountainIcon />}>
                    {profile.ancestralRegion.toLowerCase().startsWith("roots") ? profile.ancestralRegion : `Roots in ${profile.ancestralRegion}`}
                  </Chip>
                ) : null}
                {profile.relocation ? (
                  <Chip icon={<RelocationIcon open={profile.relocation === "Open to relocation"} />}>{profile.relocation}</Chip>
                ) : null}
              </div>
            </Group>
          ) : null}
        </Section>
      ) : null}

      {interests.length > 0 ? (
        <Section title="Interests">
          <div className={chips}>
            {interests.map((i) => {
              // Interests from the old site carry their own emoji ("🤲 Dua"); newer ones use our icon set.
              const own = i.match(/^([\p{Extended_Pictographic}\u200d\ufe0f]+)\s+(.+)$/u);
              return (
                <Chip key={i} icon={own ? own[1] : iconFor(i)}>
                  {own ? own[2] : i}
                </Chip>
              );
            })}
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
