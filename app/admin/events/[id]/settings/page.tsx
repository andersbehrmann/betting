import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { SettingsForm, type SettingsFormValues } from "@/components/admin/settings-form";
import { PlayersEditor } from "@/components/admin/players-editor";
import { GameToggles } from "@/components/admin/game-toggles";
import { AddGameForm } from "@/components/admin/add-game-form";
import { getEventById, getGames, getPlayers } from "@/lib/queries";
import { toDatetimeLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

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
    noWinnerPolicy: event.noWinnerPolicy,
  };

  const [games, players] = await Promise.all([getGames(event.id), getPlayers(event.id)]);

  return (
    <div className="space-y-5">
      <SettingsForm eventId={event.id} initial={values} />

      <PlayersEditor
        eventId={event.id}
        teamOneName={event.teamOne ?? ""}
        teamTwoName={event.teamTwo ?? ""}
        initialTeam1={players.filter((p) => p.team === 1).map((p) => p.name)}
        initialTeam2={players.filter((p) => p.team === 2).map((p) => p.name)}
      />

      <AddGameForm
        eventId={event.id}
        defaultStake={event.defaultStake}
        isPoints={event.eventType === "points"}
      />

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
