import { Countdown } from "./countdown";
import { formatStockholm } from "@/lib/time";
import type { EventRow } from "@/lib/types";

export function MatchBanner({ event, locked }: { event: EventRow; locked: boolean }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] bg-pitch text-chalk shadow-[0_20px_40px_-24px_rgba(8,42,29,0.9)]">
      <div className="pitch-stripes px-5 pt-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-chalk/70">{event.name}</p>
        <div className="mt-3 flex items-center justify-center gap-4 text-center">
          <span className="flex-1 font-display text-xl font-bold sm:text-2xl">{event.teamOne}</span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chalk/15 font-display text-sm">
            vs
          </span>
          <span className="flex-1 font-display text-xl font-bold sm:text-2xl">{event.teamTwo}</span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-chalk/15 bg-pitch-deep/40 px-5 py-3 text-sm">
        <div>
          <div className="text-[0.7rem] uppercase tracking-wide text-chalk/60">Avspark</div>
          <div className="font-medium">{formatStockholm(event.matchStart, "d MMM · HH:mm")}</div>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] uppercase tracking-wide text-chalk/60">
            {locked ? "Status" : "Tipsstopp om"}
          </div>
          <div className="font-medium">
            {locked ? (
              <span className="text-gold">Stängd</span>
            ) : (
              <Countdown isoDeadline={event.bettingDeadline.toISOString()} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
