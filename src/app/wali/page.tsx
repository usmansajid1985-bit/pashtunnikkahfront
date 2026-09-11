import Link from "next/link";
import { getWaliSession } from "@/lib/wali";
import { prisma } from "@/lib/prisma";
import { mapProfileView } from "@/lib/profile";
import { listThreadsForUser } from "@/lib/chat";
import { WaliHeader } from "@/components/wali/wali-header";

export const dynamic = "force-dynamic";

function avatarUrl(seed: number) {
  return `https://i.pravatar.cc/160?img=${(seed % 70) + 1}`;
}

export default async function WaliDashboardPage() {
  const session = await getWaliSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="font-bold text-lg text-ink-950">Link not valid</p>
          <p className="mt-2 text-sm text-ink-700/65">
            This wali access link is invalid or has been revoked. Please ask the profile owner to
            share a new link.
          </p>
        </div>
      </div>
    );
  }

  const profileUserId = BigInt(session.profileUserId);
  const [user, profile] = await Promise.all([
    prisma.users.findUnique({ where: { id: profileUserId } }),
    prisma.profiles.findUnique({ where: { user_id: profileUserId } }),
  ]);

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-[#faf8f7] flex items-center justify-center px-6">
        <p className="text-sm text-ink-700/65">Profile not found.</p>
      </div>
    );
  }

  const view = mapProfileView(profile, user);
  const threads = await listThreadsForUser(profileUserId);

  return (
    <div className="min-h-screen bg-[#faf8f7] text-ink-900">
      <WaliHeader watchingName={view.fullName} />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Link
          href="/wali/profile"
          className="bg-white rounded-2xl border border-ink-900/8 p-5 flex items-center gap-4 hover:border-rose-200"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view.photoUrl || avatarUrl(view.avatarSeed)}
            alt=""
            className="w-16 h-16 rounded-2xl object-cover"
            style={view.photoUrl ? undefined : { filter: "blur(6px)" }}
          />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink-950">{view.fullName}</p>
            <p className="text-sm text-ink-700/65">
              {[view.age ? `${view.age} yrs` : null, view.city, view.country].filter(Boolean).join(" · ")}
            </p>
            <p className="text-xs text-ink-700/50 mt-0.5">{view.profileCode}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-rose-600">View full profile →</span>
        </Link>

        <section className="bg-white rounded-2xl border border-ink-900/8 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-bold text-ink-950">Chats</h2>
            <p className="text-xs text-ink-700/50 mt-0.5">Read-only — you can view messages but not send any.</p>
          </div>
          {threads.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-700/60">No conversations yet.</p>
          ) : (
            <div>
              {threads.map((t) => (
                <Link
                  key={t.requestId}
                  href={`/wali/chats/${t.requestId}`}
                  className="flex items-center gap-3 px-5 py-3.5 border-t border-ink-900/6 hover:bg-ink-900/[0.03]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl(t.peerAvatarSeed)}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover shrink-0"
                    style={t.photoVisible ? undefined : { filter: "blur(5px) saturate(0.9)" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink-950 block truncate">{t.peerCode}</span>
                    <span className="text-[13px] text-ink-700/65 block truncate">
                      {t.lastMessage || "No messages yet"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
