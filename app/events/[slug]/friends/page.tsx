import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AuthNav } from "@/components/auth/auth-nav";
import { Card } from "@/components/ui";
import {
  CreateFriendGroupForm,
  JoinFriendGroupForm,
} from "@/components/events/friend-group-forms";
import { getCurrentUser } from "@/lib/auth";
import { getEventBySlug, listFriendLeaderboardsForUser } from "@/lib/queries";
import { resolveParticipant, hasPaidAccess } from "@/lib/participants";

export const dynamic = "force-dynamic";

export default async function FriendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kod?: string }>;
}) {
  const { slug } = await params;
  const { kod } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event || event.status === "draft") notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${event.slug}/friends`);

  const participant = await resolveParticipant(event.id);
  const eligible = participant !== null && hasPaidAccess(event, participant);
  const groups = eligible ? await listFriendLeaderboardsForUser(event.id, user.id) : [];

  return (
    <>
      <SiteHeader
        right={
          <>
            <Link
              href={`/events/${event.slug}/play`}
              className="rounded-lg px-2.5 py-1.5 text-muted hover:text-pitch"
            >
              Till spelen
            </Link>
            <AuthNav />
          </>
        }
      />

      <main className="mx-auto max-w-xl px-4 pb-16 pt-4">
        <Link href={`/events/${event.slug}`} className="text-sm text-muted hover:text-pitch">
          ← {event.name}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-pitch">Kompisligor</h1>
        <p className="mt-1 text-sm text-muted">
          Privata ställningar inom eventet – bara du och de du bjuder in ser dem.
        </p>

        {!eligible ? (
          <Card className="mt-6 p-6 text-center">
            <p className="font-display text-lg text-pitch">Gå med i eventet först</p>
            <p className="mt-1 text-sm text-muted">
              Kompisligor är till för dig som deltar i eventet.
            </p>
            <Link
              href={`/events/${event.slug}`}
              className="mt-3 inline-block font-medium text-grass hover:underline"
            >
              Till eventsidan →
            </Link>
          </Card>
        ) : (
          <div className="mt-6 space-y-4">
            {groups.length > 0 && (
              <div className="space-y-2">
                {groups.map((g) => (
                  <Link key={g.id} href={`/events/${event.slug}/friends/${g.id}`} className="block">
                    <Card className="p-4 transition-colors hover:border-grass">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-ink">{g.name}</span>
                        <span className="text-sm text-muted">
                          {g.memberCount} {g.memberCount === 1 ? "medlem" : "medlemmar"}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            <CreateFriendGroupForm eventId={event.id} />
            <JoinFriendGroupForm initialCode={kod} />
          </div>
        )}
      </main>
    </>
  );
}
