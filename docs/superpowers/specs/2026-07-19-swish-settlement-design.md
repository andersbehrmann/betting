# Swish-avräkning i slutsammanställningen

**Datum:** 2026-07-19
**Status:** Godkänd design → redo för implementeringsplan

## Problem

När en bettingomgång är avgjord vet varje deltagare sitt **netto** (vinst − insats),
men ingen vet vem som konkret ska Swisha vem. Idag måste det räknas ut för hand.
Vi vill att systemet automatiskt räknar ut minsta antal person-till-person-överföringar
så att alla blir kvitt.

## Bakgrund / datamodell (befintlig)

- `computeStandings(eventId)` i [lib/standings.ts](../../../lib/standings.ts) ger per deltagare:
  `{ id, name, totalStake, totalWinnings, net, ... }`.
- Potten per spel = `antal deltagare × insats`, och delas ut till vinnarna. Pengar bevaras,
  så **summan av alla netton är ~0** (sluten pott). Små öre-avvikelser kan förekomma eftersom
  insatser och utbetalningar avrundas oberoende (`round2`).
- Slutsammanställningen (admin) renderas i
  [app/admin/results/page.tsx](../../../app/admin/results/page.tsx) via
  [components/admin/results-table.tsx](../../../components/admin/results-table.tsx).
- Deltagarens egen vy finns i [app/my-bets/page.tsx](../../../app/my-bets/page.tsx) och
  visar redan deltagarens netto.

Ingen DB-ändring krävs. Ingen ny persondata (inga telefonnummer).

## Beslut

- **Synlighet:** Både admin (full lista) och deltagare (bara rader som rör en själv).
- **Presentation:** Namn + belopp, t.ex. `Anna → Erik: 120 kr`. Inga klickbara Swish-länkar.
- **Avrundning:** Alla belopp visas i **hela kronor**.
- **Avräkningen speglar nuläget** — innan facit satts är alla netton 0 → tom lista.

## Arkitektur

### Ny ren modul: `lib/settlement.ts`

Ren, testbar, ingen DB- eller server-kod. Enda ansvar: netton in → överföringar ut.

```ts
export interface Transfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number; // hela kronor, > 0
}

export function computeSettlement(
  participants: { id: string; name: string; net: number }[],
): Transfer[];
```

**Steg:**

1. **Heltalsavrunda nettona.** Avrunda varje `net` till närmaste heltal.
2. **Nollställ summan.** Beräkna residualen `sum(avrundade netton)`. Om den inte är 0,
   justera det/de netton med störst magnitud med ±1 tills summan är exakt 0.
   (Enkel, deterministisk regel: sortera fallande på magnitud och justera den första
   posten med `-residual`; residualen är i praktiken ±1–2 kr.)
3. **Dela upp** i gäldenärer (`net < 0`, ska betala) och fordringsägare (`net > 0`, ska få).
4. **Girig matchning (min-cash-flow):** sortera båda fallande på magnitud. Matcha största
   gäldenär mot största fordringsägare, för över `min(skuld, fordran)`, dra av från båda,
   ta bort den som når 0. Upprepa tills alla är kvitt. Ger som mest *n−1* överföringar.
5. Hoppa över belopp som blir 0.

Determinism: vid lika magnitud, sortera sekundärt på `id` så resultatet är stabilt.

### Presentationskomponent: `components/settlement-list.tsx`

Server-renderbar (ingen klient-state). Två användningslägen:

- **Full lista** (admin): alla `Transfer`. Tomt läge → "Inget att göra – alla är kvitt."
- **Filtrerad** (deltagare): ta in `viewerId`; visa
  - "Du ska swisha **{amount} kr** till **{toName}**" för transfers där `fromId === viewerId`.
  - "**{fromName}** ska swisha dig **{amount} kr**" för transfers där `toId === viewerId`.
  - Om inga rader rör deltagaren → visa inget (eller diskret "Du är kvitt.").

Belopp formateras som hela kronor med befintlig valuta-hjälpare (`formatMoney`, utan decimaler
för heltal) eller enkel `{amount} kr`.

### Inplaceringar

1. **Admin – Slutsammanställningen** ([app/admin/results/page.tsx](../../../app/admin/results/page.tsx)):
   nytt `Card`-avsnitt "Vem swishar vem" som renderar full `SettlementList`.
   Räknas ut från samma `standings` som redan hämtas där.
2. **Deltagare – Mina tips** ([app/my-bets/page.tsx](../../../app/my-bets/page.tsx)):
   `SettlementList` i filtrerat läge med `viewerId = participant.id`. `standings` hämtas redan där.

## Dataflöde

```
computeStandings(eventId)  ->  participants[] (med net)
        │
        ├── admin/results/page  ── computeSettlement(all) ──> SettlementList (full)
        └── my-bets/page        ── computeSettlement(all) ──> SettlementList (viewerId)
```

`computeSettlement` körs på hela deltagarlistan i båda vyerna (samma resultat); deltagarvyn
filtrerar bara vad som *visas*, så admin och deltagare alltid är konsistenta.

## Felhantering / edge cases

- **Inga settled spel / alla netton 0** → tom lista → vänligt tomt-läge.
- **Öre-residual** hanteras i steg 2 (summan tvingas till 0 före matchning).
- **En enda deltagare** eller alla på samma sida → inga överföringar.
- **Negativt och positivt netto på ören** som avrundas till 0 → deltagaren utelämnas.

## Testning

Enhetstester för `computeSettlement` (ren funktion):

- Tom lista → `[]`.
- Alla netton 0 → `[]`.
- Enkel: `[+100 A, -100 B]` → `B → A: 100`.
- Trepart: `[+100 A, -60 B, -40 C]` → `B → A: 60`, `C → A: 40`.
- Min-cash-flow: `[+50 A, +50 B, -50 C, -50 D]` → 2 överföringar, inte 4.
- Avrundning: netton med ören vars heltalssumma blir ±1 → summan tvingas till 0,
  alla belopp heltal, totalt betalt = totalt mottaget.
- Determinism: samma indata i annan ordning ger samma överföringar (efter sortering).

## Medvetet utelämnat (YAGNI)

- Telefonnummer och klickbara `swish://`-länkar.
- "Markera som swishat"-status per överföring (befintlig `paymentStatus` per deltagare räcker).
- Konfigurerbar avrundning eller "en bank betalar alla".
