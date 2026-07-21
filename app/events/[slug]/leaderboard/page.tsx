import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Card, Badge } from "@/components/ui";
import {
  getEventBySlug,
  getGames,
  getPlayers,
  getAllBets,
  getParticipants,
} from "@/lib/queries";
import { computeStandings } from "@/lib/standings";
import { buildGameViews } from "@/lib/view";
import { describeAnswer } from "@/lib/describe";
import { formatKronor, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event || event.status === "draft") notFound();

  return (
    <>
      <SiteHeader
        right={
          <Link
            href={`/events/${event.slug}/play`}
            className="rounded-lg px-2.5 py-1.5 text-muted hover:text-pitch"
          >
            Till spelen
          </Link>
        }
      />
      <main className="mx-auto max-w-xl px-4 pt-4 pb-16">
        {!event.leaderboardVisible ? (
          <Card className="p-6 text-center">
            <p className="font-display text-lg text-pitch">Resultattavlan är inte öppen</p>
            <p className="mt-1 text-sm text-muted">Admin visar tavlan när det är dags.</p>
          </Card>
        ) : (
          <>
            <Board eventId={event.id} currency={event.currency} isPoints={event.eventType === "points"} />
            {event.betsPublic && <AllTips event={event} />}
          </>
        )}
      </main>
    </>
  );
}

async function Board({
  eventId,
  currency,
  isPoints,
}: {
  eventId: string;
  currency: string;
  isPoints: boolean;
}) {
  const { participants } = await computeStandings(eventId);
  // Bara den som faktiskt lagt tips hör hemma på tavlan. Att ha gått med (eller
  // ha ett konto kopplat till eventet) räcker inte – annars dyker admin och
  // andra som aldrig spelat upp bland spelarna med 0/0.
  const played = participants.filter((p) => p.betCount > 0);
  // Poäng-event rankas på poäng, betting-event på netto.
  const ranked = [...played].sort((a, b) =>
    isPoints ? b.points - a.points || b.wins - a.wins : b.net - a.net || b.wins - a.wins,
  );

  return (
    <div className="space-y-4">
      <h1 className="px-1 font-display text-xl font-bold text-pitch">Resultattavlan 🏆</h1>

      {ranked.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">Inga deltagare ännu.</Card>
      ) : (
        <Card className="divide-y divide-line/70 overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 bg-cream-deep/60 px-4 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
            <span>#</span>
            <span>Namn</span>
            <span className="text-right">{isPoints ? "Rätt" : "Vinster"}</span>
            <span className="text-right">{isPoints ? "Poäng" : "Netto"}</span>
          </div>
          {ranked.map((p, i) => {
            // Avrunda en gång och låt tecken och färg följa den visade siffran –
            // annars får ett netto på 0,40 kr ett plustecken framför "0 kr".
            const net = Math.round(p.net) || 0;
            return (
            <div key={p.id} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 px-4 py-3">
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
                    net > 0 ? "text-win" : net < 0 ? "text-lose" : "text-muted",
                  )}
                >
                  {net > 0 ? "+" : ""}
                  {formatKronor(net, currency)}
                </span>
              )}
            </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

async function AllTips({
  event,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>;
}) {
  const [games, players, bets, participants] = await Promise.all([
    getGames(event.id),
    getPlayers(event.id),
    getAllBets(event.id),
    getParticipants(event.id),
  ]);

  const views = buildGameViews(
    games.map((g) => ({
      id: g.id,
      gameKey: g.gameKey,
      title: g.title,
      description: g.description,
      stake: g.stake,
      isJackpot: g.isJackpot,
      isCustom: g.isCustom,
      options: g.options,
    })),
    players.map((p) => ({ id: p.id, name: p.name, team: p.team })),
    { one: event.teamOne ?? "", two: event.teamTwo ?? "" },
  );
  const viewById = new Map(views.map((v) => [v.id, v]));
  const gameById = new Map(games.map((g) => [g.id, g]));
  // Samma regel som på tavlan: den som inte lagt några tips är inte en spelare.
  const betCount = new Set(bets.map((b) => b.participantId));
  const played = participants.filter((p) => betCount.has(p.id));

  return (
    <div className="mt-6 space-y-2">
      <h2 className="px-1 font-display text-lg font-bold text-pitch">Allas tips</h2>
      {played.map((p) => {
        const mine = bets
          .filter((b) => b.participantId === p.id)
          .map((b) => ({ b, view: viewById.get(b.gameId), game: gameById.get(b.gameId) }))
          .filter((x) => x.view && x.game)
          .sort((a, b) => a.game!.sortOrder - b.game!.sortOrder);
        return (
          <details key={p.id} className="group rounded-[var(--radius-card)] border border-line bg-chalk">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-medium text-ink">
              <span>{p.name}</span>
              <Badge tone="muted">{mine.length} tips</Badge>
            </summary>
            <div className="space-y-1 border-t border-line/70 px-4 py-3 text-sm">
              {mine.map(({ b, view, game }) => (
                <div key={b.id} className="flex items-start justify-between gap-3">
                  <span className="text-muted">{game!.title}</span>
                  <span className="text-right text-ink">{describeAnswer(view!, b.answerData, views)}</span>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
