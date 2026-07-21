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
  // 1. Kontrollera obalansen på de OAVRUNDADE nettona, INNAN avrundning. I en
  //    korrekt sammanställning bevaras pengarna och de summerar till exakt 0.
  //    Det enda som får dem att avvika är öresavrundning uppströms: varje netto
  //    kommer redan avrundat till hela ören (round2 i lib/standings.ts), vilket
  //    kan flytta summan som mest ett par ören per deltagare. Allt större är ett
  //    riktigt bokföringshål – t.ex. en pott utan vinnare – och får aldrig
  //    tystas ner genom att skyfflas över på en enskild spelare.
  //
  //    Att i stället summera EFTER Math.round dolde hålet: heltalsavrundningen
  //    lägger själv till upp till ±0,5 kr per deltagare, så en tolerans som
  //    rymde det bruset (~n/2 kr) svalde också ett verkligt hål på flera kronor.
  const rawResidual = participants.reduce((s, p) => s + p.net, 0);
  const tolerance = 0.02 * participants.length + 0.005;
  if (Math.abs(rawResidual) > tolerance) {
    // Felsökningstext för admin – här visas ören med flit (till skillnad från
    // tavlan och swishlistan), eftersom det är örena som pekar ut var pengarna
    // tog vägen. Avrundat till kronor skulle en liten obalans bli "0 kr".
    const belopp = (Math.round(rawResidual * 100) / 100).toLocaleString("sv-SE");
    throw new Error(
      `Sammanräkningen går inte ihop: nettona summerar till ${belopp} kr i stället för 0. ` +
        `Det beror på pengar som samlats in men inte delats ut – kontrollera spel utan vinnare.`,
    );
  }

  // 2. Heltalsavrunda nettona.
  const rounded = participants.map((p) => ({ id: p.id, name: p.name, net: Math.round(p.net) }));

  // 3. Heltalsavrundningen kan lämna en liten rest (summan av avrundade netton
  //    ≠ 0). Det är rent avrundningsbrus – den verkliga obalansen är redan
  //    godkänd ovan – så det är tryggt att jämna ut resten på posten med störst
  //    magnitud.
  const roundingResidual = rounded.reduce((s, p) => s + p.net, 0);
  if (roundingResidual !== 0 && rounded.length > 0) {
    const target = [...rounded].sort(
      (a, b) => Math.abs(b.net) - Math.abs(a.net) || (a.id < b.id ? -1 : 1),
    )[0];
    target.net -= roundingResidual;
  }

  // 4. Dela upp i gäldenärer (ska betala) och fordringsägare (ska få).
  const debtors = rounded
    .filter((p) => p.net < 0)
    .map((p) => ({ id: p.id, name: p.name, remaining: -p.net }))
    .sort((a, b) => b.remaining - a.remaining || (a.id < b.id ? -1 : 1));
  const creditors = rounded
    .filter((p) => p.net > 0)
    .map((p) => ({ id: p.id, name: p.name, remaining: p.net }))
    .sort((a, b) => b.remaining - a.remaining || (a.id < b.id ? -1 : 1));

  // 5. Girig matchning.
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
