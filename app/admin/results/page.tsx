import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { ResultsTable } from "@/components/admin/results-table";
import { SettlementList } from "@/components/settlement-list";
import { getActiveEvent, getAuditLog } from "@/lib/queries";
import { computeStandings } from "@/lib/standings";
import { formatStockholm } from "@/lib/time";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  create_event: "Skapade event",
  update_settings: "Uppdaterade inställningar",
  update_players: "Uppdaterade spelarlista",
  open_betting: "Öppnade bettingen",
  close_betting: "Stängde bettingen",
  set_facit: "Satte facit",
  settle_package: "Avgjorde matchpaketet",
  reopen_game: "Återöppnade spel",
  clear_facit: "Rensade facit",
  manual_winners: "Manuell justering av vinnare",
  recalc_game: "Räknade om vinnare",
  set_payment: "Ändrade betalningsstatus",
};

export default async function AdminResultsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const event = await getActiveEvent();

  if (!event) {
    return <Card className="p-6 text-center text-sm text-muted">Inget event ännu.</Card>;
  }

  const [standings, audit] = await Promise.all([
    computeStandings(event.id),
    getAuditLog(event.id, 60),
  ]);

  const ranked = [...standings.participants].sort((a, b) => b.net - a.net);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pitch">Slutsammanställning</h1>
        <p className="text-sm text-muted">Insats, vinst, netto och betalningsstatus per deltagare.</p>
      </div>

      <ResultsTable participants={ranked} currency={event.currency} />

      <SettlementList participants={standings.participants} currency={event.currency} />

      <div>
        <h2 className="mb-2 px-1 font-display text-lg font-bold text-pitch">Historik</h2>
        <Card className="divide-y divide-line/60 overflow-hidden">
          {audit.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted">Ingen historik ännu.</div>
          ) : (
            audit.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-ink">
                  {ACTION_LABELS[a.action] ?? a.action}
                  {a.actor === "system" && <span className="ml-1 text-xs text-muted">(system)</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{formatStockholm(a.createdAt, "d MMM HH:mm")}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
