import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { AuthNav } from "@/components/auth/auth-nav";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <>
      <SiteHeader right={<AuthNav />} />
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <h1 className="font-display text-4xl font-bold text-pitch">Tävla med dina vänner</h1>
        <p className="mt-3 text-lg text-muted">
          En plattform för att tippa och tävla kring event – från VM-finaler till Crossfit Games.
          Skapa ett gratis konto, anslut dig till ett event och klättra på leaderboarden.
        </p>
        <p className="mt-3 text-muted">
          Betting-event bygger på att deltagarna gör upp sinsemellan – vi håller koll på tips,
          resultat och ställning. Poäng-event ger poäng för rätt svar.
        </p>
        <Link
          href="/events"
          className="mt-6 inline-block rounded-[var(--radius-pill)] bg-grass px-6 py-3 font-medium text-chalk hover:bg-grass-bright"
        >
          Se alla event →
        </Link>
      </main>
    </>
  );
}
