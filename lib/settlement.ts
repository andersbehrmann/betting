// Räknar ut minsta antal person-till-person-överföringar (i hela kronor) så att
// alla deltagare blir kvitt. Ren funktion – ingen DB- eller server-kod.

export interface SettlementInput {
  id: string;
  name: string;
  net: number; // netto (vinst − insats); positivt = ska få, negativt = ska betala
}

export interface Transfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number; // hela kronor, > 0
}

/**
 * Girig min-cash-flow: matcha största skuld mot största fordran. Ger som mest
 * n−1 överföringar. Nettona heltalsavrundas och summan tvingas till exakt 0
 * (residualen läggs på posten med störst magnitud) så allt går jämnt ut.
 */
export function computeSettlement(participants: SettlementInput[]): Transfer[] {
  // 1. Heltalsavrunda nettona.
  const rounded = participants.map((p) => ({ id: p.id, name: p.name, net: Math.round(p.net) }));

  // 2. Tvinga summan till exakt 0 genom att justera posten med störst magnitud.
  const residual = rounded.reduce((s, p) => s + p.net, 0);
  if (residual !== 0 && rounded.length > 0) {
    const target = [...rounded].sort(
      (a, b) => Math.abs(b.net) - Math.abs(a.net) || (a.id < b.id ? -1 : 1),
    )[0];
    target.net -= residual;
  }

  // 3. Dela upp i gäldenärer (ska betala) och fordringsägare (ska få).
  const debtors = rounded
    .filter((p) => p.net < 0)
    .map((p) => ({ id: p.id, name: p.name, remaining: -p.net }))
    .sort((a, b) => b.remaining - a.remaining || (a.id < b.id ? -1 : 1));
  const creditors = rounded
    .filter((p) => p.net > 0)
    .map((p) => ({ id: p.id, name: p.name, remaining: p.net }))
    .sort((a, b) => b.remaining - a.remaining || (a.id < b.id ? -1 : 1));

  // 4. Girig matchning.
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(d.remaining, c.remaining);
    if (amount > 0) {
      transfers.push({ fromId: d.id, fromName: d.name, toId: c.id, toName: c.name, amount });
    }
    d.remaining -= amount;
    c.remaining -= amount;
    if (d.remaining === 0) i++;
    if (c.remaining === 0) j++;
  }

  return transfers;
}
