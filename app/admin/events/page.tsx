import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { listAllEvents } from "@/lib/queries";
import { Card, Badge } from "@/components/ui";
import { CreateEventForm } from "@/components/admin/create-event-form";
import { EventStatusControl } from "@/components/admin/event-status-control";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const events = await listAllEvents();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-pitch">Event</h1>
        <p className="text-sm text-muted">Skapa och hantera plattformens event.</p>
      </div>

      <CreateEventForm />

      <Card className="divide-y divide-line/60">
        {events.length === 0 ? (
          <p className="p-5 text-sm text-muted">Inga event ännu.</p>
        ) : (
          events.map((e) => {
            const isFootball = e.teamOne != null;
            return (
              <div key={e.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{e.name}</span>
                    <Badge tone={e.eventType === "points" ? "gold" : "green"}>
                      {e.eventType === "points" ? "Poäng" : "Betting"}
                    </Badge>
                    {isFootball && <Badge tone="muted">Match</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    /{e.slug} · {formatCents(e.joinFeeCents, e.currency)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/events/${e.slug}`}
                    className="text-sm text-muted hover:text-pitch"
                    target="_blank"
                  >
                    Visa
                  </Link>
                  <EventStatusControl eventId={e.id} status={e.status} />
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
