import { Fragment, type ReactNode } from "react";
import { parseInline, type AnnouncementBlock } from "@/lib/announcements-shared";

/** **bold**, *italic* and [links](url) inside a text block — rendered as elements, never HTML. */
export function InlineText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 ? <br /> : null}
          {parseInline(line).map((t, i) => {
            if (t.kind === "bold") return <strong key={i} className="font-semibold text-ink-950">{t.text}</strong>;
            if (t.kind === "italic") return <em key={i}>{t.text}</em>;
            if (t.kind === "link") {
              const external = /^https?:\/\//i.test(t.url);
              return (
                <a
                  key={i}
                  href={t.url}
                  className="font-semibold text-rose-600 underline underline-offset-2 hover:text-rose-700"
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {t.text}
                </a>
              );
            }
            return <Fragment key={i}>{t.text}</Fragment>;
          })}
        </Fragment>
      ))}
    </>
  );
}

function FeatureRow({ emoji, title, description, url }: { emoji: string; title: string; description?: string; url?: string }) {
  const inner: ReactNode = (
    <>
      <span aria-hidden className="shrink-0 h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center text-[19px]">
        {emoji || "✨"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink-950">{title}</span>
        {description ? <span className="block text-[13px] text-ink-700/70 mt-0.5">{description}</span> : null}
      </span>
      {url ? (
        <svg className="shrink-0 text-ink-700/35" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m9 18 6-6-6-6" />
        </svg>
      ) : null}
    </>
  );
  const cls = "flex items-center gap-3.5 py-3";
  return url ? (
    <a href={url} className={`${cls} hover:opacity-80`} {...(/^https?:\/\//i.test(url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** The body of one announcement page — every announcement uses this same renderer. */
export function AnnouncementContent({ blocks }: { blocks: AnnouncementBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return (
              <h2 key={i} className="pt-2 text-[19px] font-bold text-ink-950">
                <InlineText text={b.text} />
              </h2>
            );
          case "paragraph":
            return (
              <p key={i} className="text-[15.5px] leading-relaxed text-ink-900/75">
                <InlineText text={b.text} />
              </p>
            );
          case "list":
            return (
              <ul key={i} className="space-y-1.5 pl-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[15.5px] leading-relaxed text-ink-900/75">
                    <span aria-hidden className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    <span>
                      <InlineText text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "image":
            return (
              <figure key={i} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt={b.caption || ""} loading="lazy" className="w-full rounded-2xl border border-ink-900/6 bg-ink-900/5" />
                {b.caption ? <figcaption className="text-center text-[12.5px] text-ink-700/60">{b.caption}</figcaption> : null}
              </figure>
            );
          case "features":
            return (
              <section key={i} className="rounded-2xl border border-ink-900/8 bg-white px-4 py-3">
                {b.title ? <h3 className="pt-1 pb-1 text-[17px] font-bold text-ink-950">{b.title}</h3> : null}
                <div className="divide-y divide-ink-900/6">
                  {b.items.map((f, j) => (
                    <FeatureRow key={j} {...f} />
                  ))}
                </div>
              </section>
            );
          case "callout":
            return (
              <aside key={i} className="flex gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3.5">
                {b.emoji ? (
                  <span aria-hidden className="text-[22px] leading-none mt-0.5">
                    {b.emoji}
                  </span>
                ) : null}
                <div className="min-w-0">
                  {b.title ? <p className="text-[15px] font-bold text-ink-950">{b.title}</p> : null}
                  <p className="text-[14.5px] leading-relaxed text-ink-900/75">
                    <InlineText text={b.text} />
                  </p>
                </div>
              </aside>
            );
          case "divider":
            return <hr key={i} className="border-ink-900/8" />;
        }
      })}
    </div>
  );
}
