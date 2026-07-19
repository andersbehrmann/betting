import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MatchBanner } from "@/components/match-banner";
import { JoinForm } from "@/components/participant/join-form";
import { BettingBoard } from "@/components/participant/betting-board";
import { Card } from "@/components/ui";
import {
  getActiveEvent,
  getGames,
  getPlayers,
  getParticipantByToken,
  getBetsForParticipant,
} from "@/lib/queries";
import { getParticipantToken } from "@/lib/auth";
import { buildGameViews } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const event = await getActiveEvent();

  return (
    <>
      <SiteHeader
        right={
          <>
            <Link href="/my-bets" className="rounded-lg px-2.5 py-1.5 text-muted hover:text-pitch">
              Mina tips
            </Link>
            {event?.leaderboardVisible && (
              <Link href="/leaderboard" className="rounded-lg px-2.5 py-1.5 text-muted hover:text-pitch">
                Ligan
              </Link>
            )}
          </>
        }
      />

      <main className="mx-auto max-w-xl px-4 pt-4">
        {!event ? (
          <Card className="p-6 text-center">
            <p className="font-display text-lg text-pitch">Inget event är igång ännu</p>
            <p className="mt-1 text-sm text-muted">
              Admin behöver skapa kvällens match. Kika in igen strax!
            </p>
          </Card>
        ) : (
          <HomeContent event={event} />
        )}
      </main>

      <footer className="mx-auto mt-10 max-w-xl px-4 pb-8 text-center text-xs text-muted">
        <Link href="/admin" className="hover:text-pitch">
          Admin
        </Link>
      </footer>
    </>
  );
}

async function HomeContent({ event }: { event: NonNullable<Awaited<ReturnType<typeof getActiveEvent>>> }) {
  const token = await getParticipantToken();
  const participant = token ? await getParticipantByToken(token) : null;
  const joined = participant && participant.eventId === event.id;
  const locked = !event.bettingOpen || Date.now() > event.bettingDeadline.getTime();

  return (
    <div className="space-y-4">
      <MatchBanner event={event} locked={locked} />

      {!joined ? (
        locked ? (
          <Card className="p-6 text-center">
            <p className="font-display text-lg text-pitch">Tipsningen är stängd</p>
            <p className="mt-1 text-sm text-muted">Det går inte längre att lämna nya tips för den här matchen.</p>
          </Card>
        ) : (
          <JoinForm eventId={event.id} />
        )
      ) : (
        <JoinedContent event={event} participantId={participant!.id} participantName={participant!.name} locked={locked} />
      )}
    </div>
  );
}

async function JoinedContent({
  event,
  participantId,
  participantName,
  locked,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getActiveEvent>>>;
  participantId: string;
  participantName: string;
  locked: boolean;
}) {
  const [games, players, bets] = await Promise.all([
    getGames(event.id, true),
    getPlayers(event.id),
    getBetsForParticipant(participantId),
  ]);

  const views = buildGameViews(
    games.map((g) => ({
      id: g.id,
      gameKey: g.gameKey,
      title: g.title,
      description: g.description,
      stake: g.stake,
      isJackpot: g.isJackpot,
    })),
    players.map((p) => ({ id: p.id, name: p.name, team: p.team })),
    { one: event.teamOne, two: event.teamTwo },
  );

  const initial = bets.map((b) => ({ gameId: b.gameId, answer: b.answerData }));

  return (
    <div>
      <p className="px-1 pb-1 text-sm text-muted">
        Hej <span className="font-semibold text-pitch">{participantName}</span> 👋
      </p>

      {locked ? (
        <Card className="p-6 text-center">
          <p className="font-display text-lg text-pitch">Dina tips är låsta</p>
          <p className="mt-1 text-sm text-muted">Tipsstoppet har passerat.</p>
          <Link href="/my-bets" className="mt-3 inline-block font-medium text-grass hover:underline">
            Se dina tips och resultat →
          </Link>
        </Card>
      ) : (
        <BettingBoard
          currency={event.currency}
          teams={{ one: event.teamOne, two: event.teamTwo }}
          views={views}
          initial={initial}
        />
      )}
    </div>
  );
}
