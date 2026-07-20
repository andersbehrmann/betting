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
 * n−1 överföringar. Nettona heltalsavrundas och summan tvingas till exakt 0 så
 * allt går jämnt ut.
 *
 * Kastar om nettona inte redan summerar till ~0. En riktig obalans betyder att
 * pengar samlats in utan att bokföras (t.ex. en pott utan vinnare) och det får
 * aldrig döljas genom att skyffla mellanskillnaden till en enskild spelare –
 * det pekar ut fel person som vinnare. Se lib/scoring/unwon.ts.
 */
export function computeSettlement(participants: SettlementInput[]): Transfer[] {
  // 1. Heltalsavrunda nettona.
  const rounded = participants.map((p) => ({ id: p.id, name: p.name, net: Math.round(p.net) }));

  // 2. Avvisa allt som är större än avrundningsbrus. Varje netto kan flytta sig
  //    max ±0,5 kr vid heltalsavrundning, plus någon ensam öre från lagrade
  //    utbetalningar med decimaler.
  const residual = rounded.reduce((s, p) => s + p.net, 0);
  const tolerance = Math.ceil(rounded.length / 2) + 1;
  if (Math.abs(residual) > tolerance) {
    throw new Error(
      `Sammanräkningen går inte ihop: nettona summerar till ${residual} kr i stället för 0. ` +
        `Det beror på pengar som samlats in men inte delats ut – kontrollera spel utan vinnare.`,
    );
  }

  // 3. Jämna ut den kvarvarande öresavrundningen på posten med störst magnitud.
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
