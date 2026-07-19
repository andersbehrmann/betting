# Swish-avräkning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Räkna ut och visa minsta antal Swish-överföringar (i hela kronor) så att alla deltagare blir kvitt, både för admin (full lista) och för varje deltagare (bara sina egna rader).

**Architecture:** En ren, testbar funktion `computeSettlement` i `lib/settlement.ts` tar deltagarnas netton (från befintliga `computeStandings`), heltalsavrundar dem, tvingar summan till exakt 0, och gör en girig min-cash-flow-matchning. En server-renderad komponent `SettlementList` visar resultatet — full lista på admins Slutsammanställning och filtrerad ("Du ska swisha X till Y") på deltagarens "Mina tips". Ingen DB-ändring, ingen ny persondata.

**Tech Stack:** TypeScript, React 19 server components, Next.js 16 App Router, Vitest, Tailwind. Path-alias `@/` → projektroten.

**Spec:** [docs/superpowers/specs/2026-07-19-swish-settlement-design.md](../specs/2026-07-19-swish-settlement-design.md)

---

## File Structure

- **Create** `lib/settlement.ts` — ren avräkningsfunktion + typer (`Transfer`, `SettlementInput`, `computeSettlement`).
- **Create** `tests/settlement.test.ts` — enhetstester för `computeSettlement`.
- **Create** `components/settlement-list.tsx` — presentationskomponent (full + filtrerat läge).
- **Modify** `app/admin/results/page.tsx` — rendera full `SettlementList`.
- **Modify** `app/my-bets/page.tsx` — rendera filtrerad `SettlementList` med `viewerId`.

---

## Task 1: Ren avräkningsfunktion `computeSettlement`

**Files:**
- Create: `lib/settlement.ts`
- Test: `tests/settlement.test.ts`

- [ ] **Step 1: Skriv de fallerande testerna**

Create `tests/settlement.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeSettlement } from "@/lib/settlement";

const P = (id: string, name: string, net: number) => ({ id, name, net });

describe("computeSettlement", () => {
  it("tom lista ger inga överföringar", () => {
    expect(computeSettlement([])).toEqual([]);
  });

  it("alla netton 0 ger inga överföringar", () => {
    expect(computeSettlement([P("a", "Anna", 0), P("b", "Bo", 0)])).toEqual([]);
  });

  it("enkel: en förlorare betalar en vinnare", () => {
    const t = computeSettlement([P("a", "Anna", 100), P("b", "Bo", -100)]);
    expect(t).toEqual([
      { fromId: "b", fromName: "Bo", toId: "a", toName: "Anna", amount: 100 },
    ]);
  });

  it("två förlorare betalar en vinnare", () => {
    const t = computeSettlement([P("a", "Anna", 100), P("b", "Bo", -60), P("c", "Cia", -40)]);
    expect(t).toContainEqual({ fromId: "b", fromName: "Bo", toId: "a", toName: "Anna", amount: 60 });
    expect(t).toContainEqual({ fromId: "c", fromName: "Cia", toId: "a", toName: "Anna", amount: 40 });
    expect(t).toHaveLength(2);
  });

  it("minimerar antal överföringar (2 istället för 4)", () => {
    const t = computeSettlement([P("a", "A", 50), P("b", "B", 50), P("c", "C", -50), P("d", "D", -50)]);
    expect(t).toHaveLength(2);
    expect(t.reduce((s, x) => s + x.amount, 0)).toBe(100);
  });

  it("avrundar till hela kronor och håller summan i balans", () => {
    // 0.4->0, 0.3->0, -0.7->-1; residualen -1 justeras bort på största magnitud → allt blir 0
    const t = computeSettlement([P("a", "A", 0.4), P("b", "B", 0.3), P("c", "C", -0.7)]);
    for (const x of t) expect(Number.isInteger(x.amount)).toBe(true);
    expect(Number.isInteger(t.reduce((s, x) => s + x.amount, 0))).toBe(true);
  });

  it("belopp är alltid heltal, positiva och i balans", () => {
    const t = computeSettlement([P("a", "A", 33.33), P("b", "B", 33.33), P("c", "C", -66.66)]);
    for (const x of t) {
      expect(Number.isInteger(x.amount)).toBe(true);
      expect(x.amount).toBeGreaterThan(0);
    }
    const inSum = t.filter((x) => x.toId === "a" || x.toId === "b").reduce((s, x) => s + x.amount, 0);
    const outSum = t.reduce((s, x) => s + x.amount, 0);
    expect(inSum).toBe(outSum);
  });

  it("är deterministisk oavsett indataordning", () => {
    const a = computeSettlement([P("a", "A", 50), P("b", "B", 50), P("c", "C", -50), P("d", "D", -50)]);
    const b = computeSettlement([P("d", "D", -50), P("c", "C", -50), P("b", "B", 50), P("a", "A", 50)]);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Kör testerna och verifiera att de fallerar**

Run: `npm test -- settlement`
Expected: FAIL — `Failed to resolve import "@/lib/settlement"` / `computeSettlement is not a function`.

- [ ] **Step 3: Skriv implementationen**

Create `lib/settlement.ts`:

```ts
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
```

- [ ] **Step 4: Kör testerna och verifiera att de passerar**

Run: `npm test -- settlement`
Expected: PASS — alla åtta testfall gröna.

- [ ] **Step 5: Commit**

```bash
git add lib/settlement.ts tests/settlement.test.ts
git commit -m "feat: computeSettlement – minsta antal Swish-överföringar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Presentationskomponent `SettlementList`

**Files:**
- Create: `components/settlement-list.tsx`

Referens för mönster (server-komponent + `Card`): [components/admin/results-table.tsx](../../../components/admin/results-table.tsx) och [app/admin/results/page.tsx](../../../app/admin/results/page.tsx). `Card` importeras från `@/components/ui`.

- [ ] **Step 1: Skriv komponenten**

Create `components/settlement-list.tsx`:

```tsx
import { Card } from "@/components/ui";
import { computeSettlement, type SettlementInput } from "@/lib/settlement";

/** Belopp i hela kronor, t.ex. "120 kr" (ingen decimalvisning). */
function krona(amount: number, currency: string): string {
  const suffix = currency === "SEK" ? "kr" : currency;
  return `${amount.toLocaleString("sv-SE")} ${suffix}`;
}

export function SettlementList({
  participants,
  currency,
  viewerId,
}: {
  participants: SettlementInput[];
  currency: string;
  /** Om satt: visa bara rader som rör denna deltagare (deltagarläge). */
  viewerId?: string;
}) {
  const transfers = computeSettlement(participants);

  // Deltagarläge: bara mina egna rader.
  if (viewerId) {
    const mine = transfers.filter((t) => t.fromId === viewerId || t.toId === viewerId);
    if (mine.length === 0) return null;
    return (
      <Card className="space-y-2 p-4">
        <h2 className="font-display text-lg font-bold text-pitch">Swish</h2>
        {mine.map((t, idx) =>
          t.fromId === viewerId ? (
            <p key={idx} className="text-sm text-ink">
              Du ska swisha{" "}
              <span className="font-semibold text-lose">{krona(t.amount, currency)}</span> till{" "}
              <span className="font-medium">{t.toName}</span>
            </p>
          ) : (
            <p key={idx} className="text-sm text-ink">
              <span className="font-medium">{t.fromName}</span> ska swisha dig{" "}
              <span className="font-semibold text-win">{krona(t.amount, currency)}</span>
            </p>
          ),
        )}
      </Card>
    );
  }

  // Adminläge: full lista.
  return (
    <Card className="divide-y divide-line/60 overflow-hidden">
      <div className="px-4 py-3">
        <h2 className="font-display text-lg font-bold text-pitch">Vem swishar vem</h2>
      </div>
      {transfers.length === 0 ? (
        <div className="px-4 py-4 text-sm text-muted">Inget att göra – alla är kvitt.</div>
      ) : (
        transfers.map((t, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="text-ink">
              <span className="font-medium">{t.fromName}</span>
              <span className="mx-1.5 text-muted">→</span>
              <span className="font-medium">{t.toName}</span>
            </span>
            <span className="font-semibold text-pitch">{krona(t.amount, currency)}</span>
          </div>
        ))
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Verifiera att typkontroll/lint passerar**

Run: `npm run lint`
Expected: Inga fel för `components/settlement-list.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/settlement-list.tsx
git commit -m "feat: SettlementList – visar Swish-överföringar (full + deltagarläge)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Koppla in på admins Slutsammanställning

**Files:**
- Modify: `app/admin/results/page.tsx`

- [ ] **Step 1: Importera komponenten**

I `app/admin/results/page.tsx`, lägg till importen efter raden `import { ResultsTable } from "@/components/admin/results-table";`:

```ts
import { SettlementList } from "@/components/settlement-list";
```

- [ ] **Step 2: Rendera listan under tabellen**

I samma fil, direkt efter `<ResultsTable participants={ranked} currency={event.currency} />`, lägg till:

```tsx
      <SettlementList participants={standings.participants} currency={event.currency} />
```

(`standings.participants` innehåller `{ id, name, net, ... }` och är redan hämtad i denna komponent.)

- [ ] **Step 3: Verifiera bygge**

Run: `npm run build`
Expected: Bygget lyckas utan typfel.

- [ ] **Step 4: Commit**

```bash
git add app/admin/results/page.tsx
git commit -m "feat: visa Swish-avräkning på admins Slutsammanställning

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Koppla in på deltagarens "Mina tips"

**Files:**
- Modify: `app/my-bets/page.tsx`

- [ ] **Step 1: Importera komponenten**

I `app/my-bets/page.tsx`, lägg till importen efter raden `import { describeAnswer } from "@/lib/describe";`:

```ts
import { SettlementList } from "@/components/settlement-list";
```

- [ ] **Step 2: Rendera filtrerad lista under statistikrutorna**

I `Receipt`-funktionen, direkt efter det avslutande `)}` för `{me && ( ... )}`-blocket med de tre `StatPill` (dvs efter `</div>` som stänger `grid grid-cols-3`), lägg till:

```tsx
      <SettlementList
        participants={standings.participants}
        currency={event.currency}
        viewerId={participantId}
      />
```

`standings` och `participantId` finns redan i `Receipt`-scopet. Komponenten returnerar `null` när inga överföringar rör deltagaren, så inget extra villkor behövs.

- [ ] **Step 3: Verifiera bygge**

Run: `npm run build`
Expected: Bygget lyckas utan typfel.

- [ ] **Step 4: Commit**

```bash
git add app/my-bets/page.tsx
git commit -m "feat: visa personlig Swish-avräkning på Mina tips

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Slutverifiering

- [ ] **Step 1: Kör hela testsviten**

Run: `npm test`
Expected: Alla tester passerar (inkl. den nya `tests/settlement.test.ts`).

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: Inga fel.

- [ ] **Step 3: Manuell rökkontroll (valfritt, om dev-server körs)**

Starta dev-servern och kontrollera:
- Admin → Slutsammanställning visar kortet "Vem swishar vem" med rader `Namn → Namn: X kr` (eller "Inget att göra – alla är kvitt" innan facit satts).
- Mina tips visar "Du ska swisha X kr till …" / "… ska swisha dig X kr" för en deltagare som har en överföring, och inget kort för en som är kvitt.
```
