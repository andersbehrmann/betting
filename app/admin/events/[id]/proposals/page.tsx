import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getEventById, listProposals } from "@/lib/queries";
import { Card } from "@/components/ui";
import { ProposalCard } from "@/components/admin/proposal-card";

export const dynamic = "force-dynamic";

export default async function AdminProposalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const proposals = await listProposals(event.id);
  const pending = proposals.filter((p) => p.status === "pending");
  const reviewed = proposals.filter((p) => p.status !== "pending");
  const isPoints = event.eventType === "points";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pitch">Spelförslag</h1>
        <p className="text-sm text-muted">
          Deltagarnas förslag. Godkända förslag skapas som utkast som du publicerar när du vill.
        </p>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-display text-lg text-pitch">Inga förslag ännu</p>
          <p className="mt-1 text-sm text-muted">
            Deltagare kan föreslå spel från eventets spelsida.
          </p>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="px-1 font-display text-lg font-bold text-pitch">
                Väntar på granskning ({pending.length})
              </h2>
              {pending.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  defaultStake={event.defaultStake}
                  isPoints={isPoints}
                />
              ))}
            </div>
          )}

          {reviewed.length > 0 && (
            <div className="space-y-3">
              <h2 className="px-1 font-display text-lg font-bold text-muted">Granskade</h2>
              {reviewed.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  defaultStake={event.defaultStake}
                  isPoints={isPoints}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
