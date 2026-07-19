import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { AdminControls } from "@/components/admin/admin-controls";
import { GameAdminCard } from "@/components/admin/game-admin-card";
import {
  getActiveEvent,
  getGames,
  getPlayers,
  getAllBets,
  getAllWinners,
  getParticipants,
} from "@/lib/queries";
import { computeStandings } from "@/lib/standings";
import { buildGameViews } from "@/lib/view";
import { describeAnswer } from "@/lib/describe";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const event = await getActiveEvent();

  if (!event) {
    return (
      <Card className="p-6 text-center">
        <p className="font-display text-lg text-pitch">Inget event skapat ännu</p>
        <p className="mt-1 text-sm text-muted">Skapa kvällens match under Inställningar.</p>
        <Link href="/admin/settings" className="mt-3 inline-block font-medium text-grass hover:underline">
          Till inställningar →
        </Link>
      </Card>
    );
  }

  const [games, players, bets, winners, participants, standings] = await Promise.all([
    getGames(event.id),
    getPlayers(event.id),
    getAllBets(event.id),
    getAllWinners(event.id),
    getParticipants(event.id),
    computeStandings(event.id),
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
  const nameById = new Map(participants.map((p) => [p.id, p.name]));

  const deadlinePassed = event.bettingDeadline ? Date.now() > event.bettingDeadline.getTime() : false;
  const activeGames = games.filter((g) => g.active).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pitch">{event.name}</h1>
        <p className="text-sm text-muted">
          {event.teamOne} vs {event.teamTwo} · {participants.length} deltagare
        </p>
      </div>

      <AdminControls
        eventId={event.id}
        bettingOpen={event.bettingOpen}
        deadlinePassed={deadlinePassed}
        leaderboardVisible={event.leaderboardVisible}
        betsPublic={event.betsPublic}
      />

      <div className="space-y-3">
        <h2 className="px-1 font-display text-lg font-bold text-pitch">Spel & facit</h2>
        {activeGames.map((game) => {
          const view = viewById.get(game.id)!;
          const gbets = bets.filter((b) => b.gameId === game.id);

          const tally = new Map<string, number>();
          for (const b of gbets) {
            const label = describeAnswer(view, b.answerData, views);
            tally.set(label, (tally.get(label) ?? 0) + 1);
          }
          const distribution = [...tally.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count);

          const gwinners = winners
            .filter((w) => w.gameId === game.id)
            .map((w) => ({ name: nameById.get(w.participantId) ?? "?", payout: w.payout, isManual: w.isManual }));

          const bettors = gbets.map((b) => ({ id: b.participantId, name: nameById.get(b.participantId) ?? "?" }));
          const stat = standings.gameStats[game.id];

          return (
            <GameAdminCard
              key={game.id}
              eventId={event.id}
              view={view}
              status={game.status}
              bettingOpen={game.bettingOpen}
              result={game.resultData}
              betCount={stat?.betCount ?? gbets.length}
              pot={stat?.pot ?? 0}
              currency={event.currency}
              distribution={distribution}
              winners={gwinners}
              bettors={bettors}
              teams={{ one: event.teamOne ?? "", two: event.teamTwo ?? "" }}
              isPackage={game.isJackpot}
            />
          );
        })}
      </div>
    </div>
  );
}
