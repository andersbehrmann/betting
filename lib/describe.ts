// Gör svar/facit läsbara som text. Ren modul (klient + server).

import type { GameView } from "./view";
import { labelForValue } from "./view";
import type { PackageAnswer, ScoreAnswer } from "./scoring/types";

function scoreText(s: ScoreAnswer): string {
  return `${s.home}–${s.away}`;
}

/** Beskriver ett svar/facit som text. `allViews` behövs för matchpaketets delar. */
export function describeAnswer(
  view: GameView,
  answer: unknown,
  allViews: GameView[],
): string {
  if (answer == null) return "—";

  if (view.inputKind === "score") {
    return scoreText(answer as ScoreAnswer);
  }

  if (view.inputKind === "package") {
    const p = answer as PackageAnswer;
    const wc = allViews.find((v) => v.gameKey === "world_champion");
    const fs = allViews.find((v) => v.gameKey === "first_scorer");
    const et = allViews.find((v) => v.gameKey === "extra_time");
    const parts: string[] = [];
    if (p.world_champion && wc) parts.push(`Mästare: ${labelForValue(wc, p.world_champion)}`);
    if (p.result_90) parts.push(`Resultat: ${scoreText(p.result_90)}`);
    if (p.first_scorer && fs) parts.push(`Skytt: ${labelForValue(fs, p.first_scorer)}`);
    if (p.extra_time && et) parts.push(`Förlängning: ${labelForValue(et, p.extra_time)}`);
    return parts.length ? parts.join(" · ") : "—";
  }

  return labelForValue(view, (answer as { value: string }).value);
}
