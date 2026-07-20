// Vad händer med potten i ett spel där ingen gissade rätt?
//
// Bakgrund: tidigare skrevs inga vinnarrader alls för ett sådant spel, vilket
// betydde att insatserna samlades in men aldrig bokfördes någonstans. Summan av
// allas netto blev då negativ, och computeSettlement "rättade" det genom att
// lägga hela mellanskillnaden på en enskild spelare. Pengarna måste alltid ta
// vägen någonstans – det är hela poängen med den här modulen.
//
// Ren funktion – ingen DB, inga sidoeffekter.

import { round2 } from "./payouts";

/** Vad som ska hända med en pott som ingen vann. Väljs per event av admin. */
export type NoWinnerPolicy = "refund" | "jackpot";

export interface UnwonGame {
  gameId: string;
  /** Insatserna som ligger i potten, per deltagare. */
  stakes: { participantId: string; stake: number }[];
}

export interface UnwonDistribution {
  /** Belopp som tillfaller varje deltagare, utöver ordinarie vinster. */
  credits: Record<string, number>;
  /** Totalt belopp i potter utan vinnare. */
  totalUnwon: number;
  /** Hur mycket som rullades över till jackpotvinnarna. */
  rolledOver: number;
  /** Hur mycket som betalades tillbaka till dem som satsat. */
  refunded: number;
  /** True om policyn var "jackpot" men det saknades jackpotvinnare att ge den till. */
  fellBackToRefund: boolean;
}

/**
 * Fördelar potterna från spel utan vinnare enligt eventets policy.
 *
 * - "refund"  – var och en får tillbaka exakt sin egen insats.
 * - "jackpot" – hela beloppet delas lika mellan jackpotspelets vinnare.
 *
 * Saknas jackpotvinnare (ingen vann jackpoten heller, eller eventet har inget
 * jackpotspel) faller vi tillbaka på återbetalning. Annars skulle pengarna
 * försvinna ur bokföringen igen – exakt den bugg modulen finns för att stoppa.
 *
 * Invariant: summan av `credits` är alltid lika med `totalUnwon`.
 */
export function distributeUnwonPots(
  unwonGames: UnwonGame[],
  jackpotWinnerIds: string[],
  policy: NoWinnerPolicy,
): UnwonDistribution {
  const credits: Record<string, number> = {};
  const totalUnwon = round2(
    unwonGames.reduce((sum, g) => sum + g.stakes.reduce((s, x) => s + x.stake, 0), 0),
  );

  if (totalUnwon <= 0) {
    return { credits, totalUnwon: 0, rolledOver: 0, refunded: 0, fellBackToRefund: false };
  }

  const canRollOver = policy === "jackpot" && jackpotWinnerIds.length > 0;

  if (canRollOver) {
    // Dela lika, men lägg resten på den första vinnaren så summan blir exakt.
    const share = round2(totalUnwon / jackpotWinnerIds.length);
    let handedOut = 0;
    jackpotWinnerIds.forEach((id, i) => {
      const amount = i === jackpotWinnerIds.length - 1 ? round2(totalUnwon - handedOut) : share;
      credits[id] = round2((credits[id] ?? 0) + amount);
      handedOut = round2(handedOut + amount);
    });
    return { credits, totalUnwon, rolledOver: totalUnwon, refunded: 0, fellBackToRefund: false };
  }

  for (const g of unwonGames) {
    for (const s of g.stakes) {
      credits[s.participantId] = round2((credits[s.participantId] ?? 0) + s.stake);
    }
  }
  return {
    credits,
    totalUnwon,
    rolledOver: 0,
    refunded: totalUnwon,
    fellBackToRefund: policy === "jackpot",
  };
}
