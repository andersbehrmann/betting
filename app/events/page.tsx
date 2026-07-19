import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { AuthNav } from "@/components/auth/auth-nav";
import { Card, Badge } from "@/components/ui";
import { listBrowsableEvents } from "@/lib/queries";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await listBrowsableEvents();

  return (
    <>
      <SiteHeader right={<AuthNav />} />

      <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <h2 className="mb-3 font-display text-lg font-bold text-pitch">Aktuella event</h2>

        {events.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-display text-lg text-pitch">Inga event just nu</p>
            <p className="mt-1 text-sm text-muted">Kika in igen snart!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <Link key={e.id} href={`/events/${e.slug}`} className="block">
                <Card className="p-5 transition-colors hover:border-grass">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-lg font-bold text-pitch">{e.name}</div>
                      {e.description && <p className="mt-1 text-sm text-muted">{e.description}</p>}
                    </div>
                    <Badge tone={e.eventType === "points" ? "gold" : "green"}>
                      {e.eventType === "points" ? "Poäng" : "Betting"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-sm text-muted">
                    <span className="font-medium text-ink">{formatCents(e.joinFeeCents, e.currency)}</span>
                    {e.status === "closed" && <Badge tone="muted">Stängt</Badge>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
