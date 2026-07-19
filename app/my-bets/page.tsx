import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Card, Badge, GameStatusBadge, PaymentBadge, StatPill } from "@/components/ui";
import {
  getActiveEvent,
  getGames,
  getPlayers,
  getParticipantByToken,
  getBetsForParticipant,
} from "@/lib/queries";
import { getParticipantToken } from "@/lib/auth";
import { buildGameViews } from "@/lib/view";
import { describeAnswer } from "@/lib/describe";
import { SettlementList } from "@/components/settlement-list";
import { computeStandings } from "@/lib/standings";
import { formatMoney, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyBetsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const sp = await searchParams;
  const event = await getActiveEvent();
  const token = await getParticipantToken();
  const participant = token ? await getParticipantByToken(token) : null;
  const joined = event && participant && participant.eventId === event.id;

  return (
    <>
      <SiteHeader
        right={
          <Link href="/" className="rounded-lg px-2.5 py-1.5 text-muted hover:text-pitch">
            Till spelen
          </Link>
        }
      />
      <main className="mx-auto max-w-xl px-4 pt-4 pb-16">
        {!joined ? (
          <Card className="p-6 text-center">
            <p className="font-display text-lg text-pitch">Du har inga tips ännu</p>
            <p className="mt-1 text-sm text-muted">Gå till startsidan och häng med i tipsleken.</p>
            <Link href="/" className="mt-3 inline-block font-medium text-grass hover:underline">
              Till startsidan →
            </Link>
          </Card>
        ) : (
          <Receipt event={event!} participantId={participant!.id} justSubmitted={sp.submitted === "1"} />
        )}
      </main>
    </>
  );
}

async function Receipt({
  event,
  participantId,
  justSubmitted,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getActiveEvent>>>;
  participantId: string;
  justSubmitted: boolean;
}) {
  const [games, players, bets, standings] = await Promise.all([
    getGames(event.id),
    getPlayers(event.id),
    getBetsForParticipant(participantId),
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
    { one: event.teamOne, two: event.teamTwo },
  );
  const viewById = new Map(views.map((v) => [v.id, v]));
  const gameById = new Map(games.map((g) => [g.id, g]));
  const me = standings.participants.find((p) => p.id === participantId);

  const betList = bets
    .map((b) => ({ bet: b, view: viewById.get(b.gameId), game: gameById.get(b.gameId) }))
    .filter((x) => x.view && x.game)
    .sort((a, b) => a.game!.sortOrder - b.game!.sortOrder);

  return (
    <div className="space-y-4">
      {justSubmitted && (
        <div className="rounded-xl bg-grass/15 px-4 py-3 text-sm font-medium text-grass">
          ✓ Dina tips är inskickade! Du kan ändra dem fram till tipsstopp.
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <h1 className="font-display text-xl font-bold text-pitch">Mina tips</h1>
        {me && <PaymentBadge status={me.paymentStatus} />}
      </div>

      {me && (
        <div className="grid grid-cols-3 gap-2">
          <StatPill label="Insats" value={formatMoney(me.totalStake, event.currency)} />
          <StatPill label="Vinst" value={formatMoney(me.totalWinnings, event.currency)} tone="green" />
          <StatPill
            label="Netto"
            value={formatMoney(me.net, event.currency)}
            tone={me.net >= 0 ? "green" : "neutral"}
          />
        </div>
      )}

      <SettlementList
        participants={standings.participants}
        currency={event.currency}
        viewerId={participantId}
      />

      {betList.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          Du har inte valt några spel ännu.
          <Link href="/" className="mt-2 block font-medium text-grass hover:underline">
            Lägg dina tips →
          </Link>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {betList.map(({ bet, view, game }) => {
            const settled = game!.status === "settled" && game!.resultData != null;
            const isWinner = standings.gameStats[game!.id]?.winnerIds.includes(participantId);
            const payout = standings.gameStats[game!.id]?.payoutPerWinner ?? 0;
            return (
              <Card key={bet.id} className={cn("p-4", settled && isWinner && "border-grass/50 bg-grass/5")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{game!.title}</span>
                      {game!.isJackpot && <Badge tone="gold">Jackpot</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      Ditt tips: <span className="text-ink">{describeAnswer(view!, bet.answerData, views)}</span>
                    </p>
                  </div>
                  <GameStatusBadge status={game!.status} />
                </div>

                {settled && (
                  <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-3 text-sm">
                    <span className="text-muted">
                      Facit: <span className="text-ink">{describeAnswer(view!, game!.resultData, views)}</span>
                    </span>
                    {isWinner ? (
                      <span className="font-semibold text-win">
                        Vinst {formatMoney(payout, event.currency)}
                      </span>
                    ) : (
                      <span className="text-muted">Ingen vinst</span>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
