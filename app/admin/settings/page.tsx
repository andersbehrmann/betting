import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { SettingsForm, type SettingsFormValues } from "@/components/admin/settings-form";
import { PlayersEditor } from "@/components/admin/players-editor";
import { GameToggles } from "@/components/admin/game-toggles";
import { AddGameForm } from "@/components/admin/add-game-form";
import { getActiveEvent, getGames, getPlayers } from "@/lib/queries";
import { toDatetimeLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const event = await getActiveEvent();

  if (!event) {
    return (
      <Card className="p-6 text-center">
        <p className="font-display text-lg text-pitch">Inget event skapat ännu</p>
        <p className="mt-1 text-sm text-muted">Skapa ett event under Event.</p>
        <Link href="/admin/events" className="mt-3 inline-block font-medium text-grass hover:underline">
          Till event →
        </Link>
      </Card>
    );
  }

  const values: SettingsFormValues = {
    name: event.name,
    teamOne: event.teamOne ?? "",
    teamTwo: event.teamTwo ?? "",
    matchStart: event.matchStart ? toDatetimeLocal(event.matchStart) : "",
    bettingDeadline: event.bettingDeadline ? toDatetimeLocal(event.bettingDeadline) : "",
    currency: event.currency,
    defaultStake: event.defaultStake,
    jackpotStake: event.jackpotStake,
    starPlayerName: event.starPlayerName ?? "",
    starListenTarget: event.starListenTarget ?? "",
    countStaffCards: event.countStaffCards,
    closestResultMode: event.closestResultMode,
    packageTiebreakExact: event.packageTiebreakExact,
  };

  const [games, players] = await Promise.all([getGames(event.id), getPlayers(event.id)]);

  return (
    <div className="space-y-5">
      <SettingsForm eventId={event.id} initial={values} isNew={false} />

      <PlayersEditor
        eventId={event.id}
        teamOneName={event.teamOne ?? ""}
        teamTwoName={event.teamTwo ?? ""}
        initialTeam1={players.filter((p) => p.team === 1).map((p) => p.name)}
        initialTeam2={players.filter((p) => p.team === 2).map((p) => p.name)}
      />

      <AddGameForm eventId={event.id} defaultStake={event.defaultStake} />

      <div>
        <h2 className="mb-2 px-1 font-display text-lg font-bold text-pitch">Aktiva spel</h2>
        <p className="mb-2 px-1 text-sm text-muted">
          Slå av spel som inte ska vara med i kväll. (Öppna/stäng betting per spel gör du under Översikt.)
        </p>
        <GameToggles
          games={games.map((g) => ({
            id: g.id,
            title: g.title,
            active: g.active,
            stake: g.stake,
            isJackpot: g.isJackpot,
          }))}
          currency={event.currency}
        />
      </div>
    </div>
  );
}
