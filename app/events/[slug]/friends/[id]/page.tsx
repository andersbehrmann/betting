import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AuthNav } from "@/components/auth/auth-nav";
import { Card } from "@/components/ui";
import { InviteCode } from "@/components/events/friend-group-forms";
import { getCurrentUser } from "@/lib/auth";
import {
  getEventBySlug,
  getFriendLeaderboardById,
  isFriendLeaderboardMember,
  getFriendLeaderboardParticipantIds,
} from "@/lib/queries";
import { computeStandings } from "@/lib/standings";
import { formatMoney, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FriendLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const event = await getEventBySlug(slug);
  if (!event || event.status === "draft") notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${event.slug}/friends/${id}`);

  const group = await getFriendLeaderboardById(id);
  // Ligan måste tillhöra eventet i URL:en – annars går det att nå den via fel slug.
  if (!group || group.eventId !== event.id) notFound();

  // SEKRETESSGRIND: bara medlemmar får se ligan. notFound() i stället för ett
  // "ej behörig"-meddelande, så att man inte ens kan bekräfta att ligan finns.
  if (!(await isFriendLeaderboardMember(group.id, user.id))) notFound();

  const [participantIds, standings] = await Promise.all([
    getFriendLeaderboardParticipantIds(group.id, event.id),
    computeStandings(event.id),
  ]);

  const memberIds = new Set(participantIds);
  const isPoints = event.eventType === "points";
  const ranked = standings.participants
    .filter((p) => memberIds.has(p.id))
    .sort((a, b) =>
      isPoints ? b.points - a.points || b.wins - a.wins : b.net - a.net || b.wins - a.wins,
    );

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviteUrl = `${base}/events/${event.slug}/friends?kod=${group.inviteCode}`;

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
        <Link
          href={`/events/${event.slug}/friends`}
          className="text-sm text-muted hover:text-pitch"
        >
          ← Kompisligor
        </Link>

        <h1 className="mt-2 font-display text-2xl font-bold text-pitch">{group.name}</h1>
        <p className="mt-0.5 text-sm text-muted">
          Privat liga i {event.name} · {group.memberCount}{" "}
          {group.memberCount === 1 ? "medlem" : "medlemmar"}
        </p>

        <Card className="mt-4 p-4">
          <p className="text-sm text-muted">Bjud in fler genom att dela koden:</p>
          <InviteCode code={group.inviteCode} url={inviteUrl} />
        </Card>

        <div className="mt-6">
          {ranked.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted">
              Ingen i ligan har lagt några tips ännu.
            </Card>
          ) : (
            <Card className="divide-y divide-line/70 overflow-hidden">
              <div className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 bg-cream-deep/60 px-4 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                <span>#</span>
                <span>Namn</span>
                <span className="text-right">{isPoints ? "Rätt" : "Vinster"}</span>
                <span className="text-right">{isPoints ? "Poäng" : "Netto"}</span>
              </div>
              {ranked.map((p, i) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 px-4 py-3"
                >
                  <span className={cn("font-display text-lg", i === 0 ? "text-gold" : "text-muted")}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </span>
                  <span className="truncate font-medium text-ink">{p.name}</span>
                  <span className="text-right tabular-nums text-muted">{p.wins}</span>
                  {isPoints ? (
                    <span className="text-right font-display font-bold tabular-nums text-ink">
                      {p.points} p
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "text-right font-display font-bold tabular-nums",
                        p.net > 0 ? "text-win" : p.net < 0 ? "text-lose" : "text-muted",
                      )}
                    >
                      {p.net > 0 ? "+" : ""}
                      {formatMoney(p.net, event.currency)}
                    </span>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
