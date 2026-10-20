import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNavCounts } from "@/lib/dashboard";
import { BrowseAppNav } from "@/components/browse/app-nav";
import { getAnnouncementPage, getOtherAnnouncements, markAnnouncementRead } from "@/lib/announcements";
import { ANNOUNCEMENT_CATEGORIES, announcementDate } from "@/lib/announcements-shared";
import { AnnouncementContent, InlineText } from "@/components/announcements/announcement-content";
import { AnnouncementCardRow } from "@/components/announcements/announcement-card";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const page = await getAnnouncementPage(decodeURIComponent(slug), null, preview);
  return { title: page ? `${page.pageTitle} — Pashtun Nikah` : "Announcement — Pashtun Nikah" };
}

const LIST_HREF = "/notifications?tab=announcements";

/**
 * N52: the one reusable template every announcement opens in (its own URL). Opening it marks the
 * announcement read for this member. `?preview=<token>` (from the admin editor) shows drafts and
 * scheduled ones before they go live.
 */
export default async function AnnouncementPageRoute({ params, searchParams }: Params) {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const session = await getSession();
  const userId = session ? BigInt(session.userId) : null;

  const page = await getAnnouncementPage(decodeURIComponent(slug), userId, preview);
  if (!page) notFound();
  if (!page.isPreview && !userId) redirect(`/login?next=${encodeURIComponent(`/announcements/${slug}`)}`);

  const [others, navCounts] = await Promise.all([
    userId && !page.isPreview ? getOtherAnnouncements(userId, page.id) : Promise.resolve([]),
    userId ? getNavCounts(userId) : Promise.resolve(null),
    userId && !page.isPreview && !page.read ? markAnnouncementRead(userId, page.id) : Promise.resolve(),
  ]);
  const category = ANNOUNCEMENT_CATEGORIES[page.category];

  return (
    <div className={`min-h-screen bg-white text-ink-900 ${navCounts ? "lg:pl-60" : ""}`}>
      {navCounts && session ? (
        <BrowseAppNav
          profileCode={session.profileCode}
          active="overview"
          unreadCount={navCounts.unreadMessages}
          requestsCount={navCounts.incomingRequests}
          bellUnread={navCounts.bellUnread}
        />
      ) : null}

      {page.isPreview ? (
        <div className="sticky top-0 z-30 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-[13px] font-semibold text-amber-800">
          Preview — members can&apos;t see this announcement until it&apos;s published.
        </div>
      ) : null}

      <article className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-[calc(2.5rem+var(--pn-bottom-nav-h))] lg:pb-16">
        <Link href={LIST_HREF} className="inline-flex items-center gap-2 text-[15px] font-semibold text-rose-600 hover:text-rose-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to announcements
        </Link>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold ${category.tint}`}>
            <span aria-hidden>{page.emoji}</span>
            {category.label}
          </span>
          <span className="text-[13px] text-ink-700/55">{announcementDate(page.publishedAt)}</span>
        </div>

        <h1 className="mt-4 text-[28px] sm:text-[34px] font-bold leading-tight text-ink-950">{page.pageTitle}</h1>
        {page.subtitle ? <p className="mt-2 text-[16px] text-ink-700/70">{page.subtitle}</p> : null}

        {page.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.coverUrl}
            alt=""
            className="mt-5 w-full aspect-[16/9] object-cover rounded-2xl border border-ink-900/6 bg-ink-900/5"
          />
        ) : null}

        <div className="mt-6">
          <AnnouncementContent blocks={page.blocks} />
        </div>

        {page.closing || page.signOff ? (
          <div className="mt-6 space-y-4">
            {page.closing ? (
              <p className="text-[15.5px] leading-relaxed text-ink-900/75">
                <InlineText text={page.closing} />
              </p>
            ) : null}
            {page.signOff ? (
              <p className="text-[15.5px] leading-relaxed text-ink-900/75 whitespace-pre-line">{page.signOff}</p>
            ) : null}
          </div>
        ) : null}

        {others.length > 0 ? (
          <section className="mt-10 border-t border-ink-900/8 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[19px] font-bold text-ink-950">More announcements</h2>
              <Link href={LIST_HREF} className="text-[14px] font-semibold text-rose-600 hover:text-rose-700">
                View all
              </Link>
            </div>
            <div className="mt-3 space-y-2.5">
              {others.map((c) => (
                <AnnouncementCardRow key={c.id} card={c} from="page" />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </div>
  );
}
