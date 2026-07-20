import { Countdown } from "./countdown";
import type { EventRow } from "@/lib/types";

/**
 * Banner för generiska event (utan lag/avspark) – motsvarigheten till MatchBanner
 * som är fotbollsspecifik. Visar namn, beskrivning och tipsstopp/status.
 */
export function EventBanner({ event, locked }: { event: EventRow; locked: boolean }) {
  const isPoints = event.eventType === "points";

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] bg-pitch text-chalk shadow-[0_20px_40px_-24px_rgba(8,42,29,0.9)]">
      <div className="pitch-stripes px-5 pt-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-chalk/70">
          {isPoints ? "Poängtävling" : "Event"}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{event.name}</h1>
        {event.description && <p className="mt-1 text-sm text-chalk/75">{event.description}</p>}
      </div>
      <div className="flex items-center justify-between border-t border-chalk/15 bg-pitch-deep/40 px-5 py-3 text-sm">
        <div>
          <div className="text-[0.7rem] uppercase tracking-wide text-chalk/60">
            {isPoints ? "Poäng" : "Spel"}
          </div>
          <div className="font-medium">
            {isPoints ? "Rätt svar ger poäng" : "Deltagarna gör upp sinsemellan"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] uppercase tracking-wide text-chalk/60">
            {locked ? "Status" : event.bettingDeadline ? "Stänger om" : "Status"}
          </div>
          <div className="font-medium">
            {locked ? (
              <span className="text-gold">Stängd</span>
            ) : event.bettingDeadline ? (
              <Countdown isoDeadline={event.bettingDeadline.toISOString()} />
            ) : (
              <span className="text-gold">Öppet</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
