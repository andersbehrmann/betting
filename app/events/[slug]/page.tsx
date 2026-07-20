import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AuthNav } from "@/components/auth/auth-nav";
import { Card, Badge } from "@/components/ui";
import { JoinButton } from "@/components/events/join-button";
import { PayButton } from "@/components/events/pay-button";
import { getCurrentUser } from "@/lib/auth";
import { getEventBySlug, getMembership, getParticipants, getGames } from "@/lib/queries";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ betalning?: string }>;
}) {
  const { slug } = await params;
  const { betalning } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event || event.status === "draft") notFound();

  const [user, participants, games] = await Promise.all([
    getCurrentUser(),
    getParticipants(event.id),
    getGames(event.id, true),
  ]);
  const membership = user ? await getMembership(event.id, user.id) : null;
  // Spelbart så snart eventet har aktiva spel – gäller både match- och poäng-event.
  const hasGames = games.length > 0;

  return (
    <>
      <SiteHeader
        right={
          <>
            <Link href="/events" className="rounded-lg px-2.5 py-1.5 text-muted hover:text-pitch">
              Event
            </Link>
            <AuthNav />
          </>
        }
      />

      <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
        <Link href="/events" className="text-sm text-muted hover:text-pitch">
          ← Alla event
        </Link>

        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-bold text-pitch">{event.name}</h1>
          <Badge tone={event.eventType === "points" ? "gold" : "green"}>
            {event.eventType === "points" ? "Poäng" : "Betting"}
          </Badge>
        </div>
        {event.description && <p className="mt-2 text-muted">{event.description}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-[var(--radius-pill)] bg-cream-deep px-3 py-1 font-medium text-ink">
            Avgift: {formatCents(event.joinFeeCents, event.currency)}
          </span>
          <span className="text-muted">{participants.length} deltagare</span>
          {event.status === "closed" && <Badge tone="muted">Stängt</Badge>}
        </div>

        {betalning === "klar" && (
          <Card className="mt-6 border-grass/40 bg-grass/8 p-4">
            <p className="text-sm font-medium text-grass">
              Tack! Betalningen är mottagen. Så fort den bekräftats låses spelen upp –
              ladda om sidan om det dröjer någon sekund.
            </p>
          </Card>
        )}
        {betalning === "avbruten" && (
          <Card className="mt-6 p-4">
            <p className="text-sm text-muted">Betalningen avbröts – du kan försöka igen.</p>
          </Card>
        )}

        <div className="mt-6">
          {!user ? (
            <Card className="p-6 text-center">
              <p className="font-display text-lg text-pitch">Skapa konto för att gå med</p>
              <p className="mt-1 text-sm text-muted">Det är gratis att skapa ett konto.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link
                  href={`/register?next=/events/${event.slug}`}
                  className="rounded-[var(--radius-pill)] bg-grass px-5 py-2.5 font-medium text-chalk hover:bg-grass-bright"
                >
                  Skapa konto
                </Link>
                <Link
                  href={`/login?next=/events/${event.slug}`}
                  className="rounded-[var(--radius-pill)] border border-line bg-chalk px-5 py-2.5 font-medium text-ink hover:border-grass"
                >
                  Logga in
                </Link>
              </div>
            </Card>
          ) : membership && event.joinFeeCents > 0 && membership.joinFeeStatus !== "paid" ? (
            // Medlemskap finns men avgiften är obetald → slutför betalningen.
            <Card className="p-6">
              <Badge tone="red">Avgift ej betald</Badge>
              <p className="mt-3 text-sm text-muted">
                Slutför betalningen på {formatCents(event.joinFeeCents, event.currency)} för att
                låsa upp spelen.
              </p>
              <div className="mt-4">
                <PayButton eventId={event.id} label="Betala nu" />
              </div>
            </Card>
          ) : membership ? (
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Badge tone="green">Du är med</Badge>
                {event.joinFeeCents > 0 && <Badge tone="green">Avgift betald</Badge>}
              </div>
              {hasGames ? (
                <Link
                  href={`/events/${event.slug}/play`}
                  className="mt-4 inline-block font-medium text-grass hover:underline"
                >
                  {event.eventType === "points" ? "Till frågorna →" : "Till tipsningen →"}
                </Link>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Spelen läggs upp av admin. Håll utkik – du kan snart lägga dina svar här.
                </p>
              )}
            </Card>
          ) : event.status !== "open" ? (
            <Card className="p-6 text-center">
              <p className="text-muted">Eventet tar inte emot nya deltagare just nu.</p>
            </Card>
          ) : event.joinFeeCents > 0 ? (
            <Card className="p-6 text-center">
              <p className="font-display text-lg text-pitch">
                Anslut för {formatCents(event.joinFeeCents, event.currency)}
              </p>
              <p className="mt-1 mb-4 text-sm text-muted">
                Engångsavgift – betalas säkert med kort via Stripe.
              </p>
              <PayButton
                eventId={event.id}
                label={`Betala ${formatCents(event.joinFeeCents, event.currency)} & gå med`}
              />
            </Card>
          ) : (
            <JoinButton eventId={event.id} label="Gå med (gratis)" />
          )}
        </div>
      </main>
    </>
  );
}
