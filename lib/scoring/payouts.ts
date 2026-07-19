// Pott- och utbetalningsberäkning. Rena funktioner.

/** Avrunda till kronor med 2 decimaler (för visning). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Potten för ett spel = antal deltagare i spelet × insatsen per spel. */
export function potFor(participantCount: number, stake: number): number {
  return participantCount * stake;
}

/**
 * Utbetalning per vinnare = potten delad lika. Exakt (decimaler bevaras);
 * admin kan justera slutbetalning manuellt. Retur 0 om inga vinnare.
 */
export function payoutPerWinner(pot: number, winnerCount: number): number {
  if (winnerCount <= 0) return 0;
  return pot / winnerCount;
}

export interface ParticipantSummary {
  participantId: string;
  totalStake: number;
  totalWinnings: number;
  net: number;
}

/**
 * Sammanställer varje deltagares insats, vinst och netto.
 * stakesByParticipant: summa insatser deltagaren lagt (bara valda spel).
 * winningsByParticipant: summa utbetalningar deltagaren fått.
 */
export function summarize(
  participantIds: string[],
  stakesByParticipant: Record<string, number>,
  winningsByParticipant: Record<string, number>,
): ParticipantSummary[] {
  return participantIds.map((id) => {
    const totalStake = round2(stakesByParticipant[id] ?? 0);
    const totalWinnings = round2(winningsByParticipant[id] ?? 0);
    return {
      participantId: id,
      totalStake,
      totalWinnings,
      net: round2(totalWinnings - totalStake),
    };
  });
}
