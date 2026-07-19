# Event-scopead routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gör admin och deltagarvyer event-medvetna genom att alltid läsa eventet från URL:en och skicka det explicit in i queries och server actions, i stället för att gissa "nyaste betting-eventet".

**Architecture:** Server actions får `eventId` som argument (fas 1). Admin-sidorna flyttas under `/admin/events/[id]/…` (fas 2) och deltagarsidorna under `/events/[slug]/…` med ny landningsrot `/` (fas 3). `getActiveEvent()` tas bort sist som regressionsskydd (fas 4). Varje fasgräns lämnar appen byggbar och körbar.

**Tech Stack:** Next.js 16.2 (App Router, modifierad — se `AGENTS.md`, läs `node_modules/next/dist/docs/` innan Next-API:er skrivs), TypeScript, Neon (Postgres) via `@neondatabase/serverless`, Zod, Vitest (endast för `lib/scoring`).

**Design:** `docs/superpowers/specs/2026-07-19-event-scoped-routing-design.md`

---

## Konventioner för alla tasks

- **Async params:** Route-parametrar är Promises i denna Next-version. Följ mönstret som redan finns i `app/events/[slug]/page.tsx`: `{ params }: { params: Promise<{ id: string }> }` och `const { id } = await params;`.
- **Verifiering (snabb):** `npx tsc --noEmit` (typecheck) — det finns inget `typecheck`-script, kör `tsc` direkt. Kör även `npm run lint`.
- **Verifiering (fasgräns):** `npm run build` ska passera, plus manuell browser-koll enligt fasens sista task.
- **Grep-regel:** Efter fas 4 får `grep -rn "getActiveEvent" app lib components` ge **noll** träffar.
- **Commits:** En commit per task, på branch `plattform`. Prefix `refactor:`/`feat:`/`chore:`.
- Rör INTE datamodellen. Schemat stödjer redan flera event.

---

## FAS 1 — Server actions får `eventId`

Mål: koppla loss alla actions från `getActiveEvent()` genom att ta `eventId` som argument, och uppdatera nuvarande anropare (som fortfarande har `event` via `getActiveEvent` på oflyttade sidor) att skicka `event.id`. Bygget förblir grönt.

### Task 1: `submitBets` tar `eventId`

**Files:**
- Modify: `app/actions.ts:95-143`
- Modify: `components/participant/betting-board.tsx` (anropar `submitBets`)

- [ ] **Step 1: Bekräfta anroparen**

Run: `grep -n "submitBets" components/participant/betting-board.tsx`
Expected: import + anrop. Notera raden.

- [ ] **Step 2: Ändra signaturen i `app/actions.ts`**

Ersätt funktionshuvudet och event-resolutionen (nuvarande rad 95-107):

```ts
export async function submitBets(eventId: string, selections: SubmitSelection[]): Promise<ActionResult> {
  const token = await getParticipantToken();
  if (!token) return { ok: false, error: "Du är inte inloggad som deltagare." };
  const participant = await getParticipantByToken(token);
  if (!participant) return { ok: false, error: "Din deltagarsession är ogiltig." };

  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  // Deltagaren måste tillhöra just detta event (medlemskap via deltagar-token).
  if (event.id !== participant.eventId) {
    return { ok: false, error: "Du är inte deltagare i det här eventet." };
  }
  if (!isGloballyOpen(event)) {
    return { ok: false, error: "Tipsningen är stängd – tipsen är låsta." };
  }
```

Ta bort `getActiveEvent` ur importlistan högst upp i filen (rad 7) om inget annat i filen använder den (det gör det inte efter denna ändring). `getEventById` är redan importerad (rad 8).

- [ ] **Step 3: Uppdatera `revalidatePath` i slutet av `submitBets`**

Behåll `revalidatePath("/")` tills fas 3 (roten finns kvar som tipsning under fas 1-2). Låt raderna `revalidatePath("/my-bets")` stå kvar oförändrade — de städas i fas 3.

- [ ] **Step 4: Uppdatera `betting-board.tsx` att skicka `eventId`**

I `components/participant/betting-board.tsx`: lägg till `eventId: string` i komponentens props och skicka det som första argument: `submitBets(eventId, selections)`. Skicka ned `eventId={event.id}` från renderande sida (`app/page.tsx`, som har `event.id`; efter fas 3 kommer det från `getEventBySlug`-eventet).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS, inga fel om `submitBets`-argument.

- [ ] **Step 6: Commit**

```bash
git add app/actions.ts components
git commit -m "refactor: submitBets tar eventId explicit i stället för getActiveEvent"
```

### Task 2: Admin-actions med implicit event tar `eventId`

De sex admin-actions som idag kallar `getActiveEvent()`: `saveEventSettings`, `setBettingOpen`, `toggleEventFlag`, `addCustomGame`, `settlePackage`, `setPaymentStatus`.

**Files:**
- Modify: `app/admin/actions.ts` (raderna 188-206, 226-235, 237-248, 280-304, 340-362, 411-419)

- [ ] **Step 1: `setBettingOpen(eventId, open)`** — ersätt rad 226-235:

```ts
export async function setBettingOpen(eventId: string, open: boolean): Promise<Result> {
  const g = await guard();
  if (g) return g;
  await qSetBettingOpen(eventId, open);
  await insertAudit(eventId, "admin", open ? "open_betting" : "close_betting", null, null);
  revalidateAdmin();
  return { ok: true };
}
```

- [ ] **Step 2: `toggleEventFlag(eventId, flag, value)`** — ersätt rad 237-248:

```ts
export async function toggleEventFlag(
  eventId: string,
  flag: "leaderboard_visible" | "bets_public",
  value: boolean,
): Promise<Result> {
  const g = await guard();
  if (g) return g;
  await setEventFlag(eventId, flag, value);
  revalidateAdmin();
  return { ok: true };
}
```

- [ ] **Step 3: `addCustomGame(eventId, raw)`** — ersätt rad 280-304, byt ut `const event = await getActiveEvent(); if (!event) …` mot en `getEventById`-koll och använd `eventId`:

```ts
export async function addCustomGame(eventId: string, raw: CustomGameInputRaw): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const parsed = customGameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ogiltigt spel (minst 2 svarsalternativ krävs)." };
  }
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };

  const data = parsed.data;
  const options = data.options.map((label, i) => ({ value: `o${i}`, label }));
  const gameKey = `custom_${randomBytes(4).toString("hex")}`;

  const id = await createCustomGame(event.id, gameKey, {
    title: data.title,
    description: data.description || null,
    stake: data.stake,
    options,
    bettingOpen: data.bettingOpen,
  });
  await insertAudit(event.id, "admin", "add_custom_game", id, { title: data.title });
  revalidateAdmin();
  return { ok: true };
}
```

- [ ] **Step 4: `settlePackage(eventId)`** — ersätt rad 340-362, byt `const event = await getActiveEvent(); if (!event) …` mot:

```ts
export async function settlePackage(eventId: string): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const event = await getEventById(eventId);
  if (!event) return { ok: false, error: "Eventet finns inte." };
  const games = await getGames(event.id);
  const pkg = games.find((x) => x.gameKey === PACKAGE_GAME_KEY);
  if (!pkg) return { ok: false, error: "Matchpaketet saknas." };

  const ordinaryResults: Partial<Record<string, GameResult>> = {};
  for (const key of ["world_champion", "result_90", "first_scorer", "extra_time"]) {
    const gme = games.find((x) => x.gameKey === key);
    if (gme?.resultData != null) ordinaryResults[key] = gme.resultData;
  }
  const result: PackageResult = assemblePackageResult(ordinaryResults, event.packageTiebreakExact);

  await setGameResult(pkg.id, result);
  await setGameStatus(pkg.id, "settled", true);
  await insertAudit(event.id, "admin", "settle_package", pkg.id, { result });
  await recalcGame(pkg.id);
  revalidateAdmin();
  return { ok: true };
}
```

- [ ] **Step 5: `setPaymentStatus(eventId, participantId, status)`** — ersätt rad 411-419:

```ts
export async function setPaymentStatus(
  eventId: string,
  participantId: string,
  status: PaymentStatus,
): Promise<Result> {
  const g = await guard();
  if (g) return g;
  await qSetPaymentStatus(participantId, status);
  await insertAudit(eventId, "admin", "set_payment", null, { participantId, status });
  revalidateAdmin();
  return { ok: true };
}
```

- [ ] **Step 6: `saveEventSettings(eventId, raw)`** — ersätt rad 188-206. Detta är fotbolls-("match")-eventets inställningsformulär. Den ska nu **uppdatera det angivna eventet** i stället för update-or-create på "aktivt event":

```ts
export async function saveEventSettings(eventId: string, raw: SettingsInputRaw): Promise<Result> {
  const g = await guard();
  if (g) return g;
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const settings = toEventSettings(parsed.data);

  const existing = await getEventById(eventId);
  if (!existing) return { ok: false, error: "Eventet finns inte." };
  await updateEventSettings(existing.id, settings);
  await insertAudit(existing.id, "admin", "update_settings", null, null);
  revalidateAdmin();
  return { ok: true };
}
```

Not: create-grenen (som skapade ett fotbollsevent + spel när inget fanns) utgår. Nya event skapas via `createEventAction`/`createPlatformEvent` i event-listan. `createEvent`, `createGamesForEvent` och `slugify` kan bli oanvända — låt dem stå tills fas 4:s städning där `npm run lint` visar oanvänt.

- [ ] **Step 7: Ta bort `getActiveEvent` ur importlistan** (rad 9) i `app/admin/actions.ts`. Kvarvarande `getActiveEvent`-anrop i denna fil ska nu vara noll:

Run: `grep -n "getActiveEvent" app/admin/actions.ts`
Expected: inga träffar.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: FEL i anropare (admin-controls, game-admin-card, settings-form, results-page) som ännu inte skickar `eventId`. Dessa fixas i Task 3. Det är förväntat mellan-tillstånd — commit ändå INTE förrän Task 3.

### Task 3: Uppdatera admin-komponenter/sidor att skicka `eventId`

**Files (exakta anropare):**
- Modify: `components/admin/admin-controls.tsx` — `setBettingOpen`, `toggleEventFlag`
- Modify: `components/admin/settings-form.tsx` — `saveEventSettings` (`savePlayers` tar redan `eventId`)
- Modify: `components/admin/add-game-form.tsx` — `addCustomGame`
- Modify: `components/admin/game-admin-card.tsx` — `settlePackage`
- Modify: `components/admin/results-table.tsx` — `setPaymentStatus`
- Modify: `app/admin/page.tsx`, `app/admin/settings/page.tsx`, `app/admin/results/page.tsx` — skicka `event.id` som `eventId`-prop ner i ovanstående

- [ ] **Step 1: Bekräfta anroparna och deras rader**

Run: `grep -n "setBettingOpen\|toggleEventFlag\|addCustomGame\|settlePackage\|saveEventSettings\|setPaymentStatus" components/admin/admin-controls.tsx components/admin/settings-form.tsx components/admin/add-game-form.tsx components/admin/game-admin-card.tsx components/admin/results-table.tsx`
Expected: en träff per action i respektive fil. Notera raderna.

- [ ] **Step 2: `admin-controls.tsx`** — lägg till `eventId: string` i `AdminControls`-props och skicka in i anropen:

```ts
// props-typen:
export function AdminControls({
  eventId,
  bettingOpen,
  deadlinePassed,
  leaderboardVisible,
  betsPublic,
}: {
  eventId: string;
  bettingOpen: boolean;
  deadlinePassed: boolean;
  leaderboardVisible: boolean;
  betsPublic: boolean;
}) {
  // ...
  // anropen blir:
  //   setBettingOpen(eventId, v)
  //   toggleEventFlag(eventId, "leaderboard_visible", v)
  //   toggleEventFlag(eventId, "bets_public", v)
}
```

- [ ] **Step 3: `app/admin/page.tsx`** — skicka `eventId={event.id}` till `<AdminControls … />` (runt rad 72).

- [ ] **Step 4: Övriga anropare** — lägg till `eventId: string` i respektive komponents props och skicka som första argument:
  - `components/admin/settings-form.tsx`: `saveEventSettings(eventId, raw)`. (`savePlayers` tar redan `eventId`.)
  - `components/admin/add-game-form.tsx`: `addCustomGame(eventId, raw)`.
  - `components/admin/game-admin-card.tsx`: `settlePackage(eventId)`.
  - `components/admin/results-table.tsx`: `setPaymentStatus(eventId, participantId, status)`.
  Renderande sidor (`app/admin/settings/page.tsx`, `app/admin/results/page.tsx`) har `event` via `getActiveEvent()` och skickar `eventId={event.id}` ner till komponenterna.

- [ ] **Step 5: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS. Alla actions får nu `eventId` från anroparen; sidorna hämtar fortfarande event via `getActiveEvent()` (oförändrat beteende, men urkopplat i action-lagret).

- [ ] **Step 6: Commit**

```bash
git add app/admin components/admin
git commit -m "refactor: admin-actions tar eventId; anropare skickar event.id"
```

### Task 4: Fas 1 browser-verifiering

- [ ] **Step 1:** Starta dev-servern och logga in som admin. Öppna `/admin` (visar fortfarande nyaste betting-eventet via `getActiveEvent`). Testa: öppna/stäng betting, toggla resultattavla, spara en inställning. Allt ska fungera som innan (ingen regressionsförändring — bara intern refaktor). Notera att event-valet ännu inte ändrats; det kommer i fas 2.

---

## FAS 2 — Admin event-scopeade routes

Mål: flytta Översikt/Inställningar/Resultat till `/admin/events/[id]/…`, resolva event via `getEventById`, gör headern kontextuell, `/admin` → redirect.

### Task 5: Flytta Översikt till `/admin/events/[id]`

**Files:**
- Create: `app/admin/events/[id]/page.tsx` (från `app/admin/page.tsx`)
- Modify: `app/admin/page.tsx` → redirect

- [ ] **Step 1:** `git mv app/admin/page.tsx app/admin/events/[id]/page.tsx`

- [ ] **Step 2:** I den flyttade filen: byt event-resolutionen. Ersätt funktionshuvudet och `const event = await getActiveEvent();` (rad 20-23) med:

```ts
import { notFound, redirect } from "next/navigation";
import { getEventById } from "@/lib/queries";
// ... behåll övriga importer, ta bort getActiveEvent ur importlistan

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  // ... resten av funktionskroppen oförändrad (games/players/bets/… hämtas redan via event.id)
```

Behåll resten av komponentkroppen exakt som den var — den använder redan `event.id` överallt.

- [ ] **Step 3:** Skapa ny `app/admin/page.tsx` som redirect till listan:

```ts
import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/admin/events");
}
```

- [ ] **Step 4:** Uppdatera event-listan att länka in per event. I `app/admin/events/page.tsx`, gör varje event-rad klickbar till `/admin/events/${e.id}` (lägg till en "Hantera →"-länk bredvid "Visa"):

```tsx
<Link href={`/admin/events/${e.id}`} className="text-sm font-medium text-grass hover:underline">
  Hantera
</Link>
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. (Inställningar/Resultat ligger kvar på gamla URL:er tills Task 6-7 — headern länkar fel tills Task 8, men bygget är grönt.)

- [ ] **Step 6: Commit**

```bash
git add app/admin
git commit -m "feat: admin-översikt event-scopead på /admin/events/[id]"
```

### Task 6: Flytta Inställningar till `/admin/events/[id]/settings`

**Files:**
- Create: `app/admin/events/[id]/settings/page.tsx` (från `app/admin/settings/page.tsx`)

- [ ] **Step 1:** `git mv app/admin/settings/page.tsx app/admin/events/[id]/settings/page.tsx`

- [ ] **Step 2:** Byt event-resolution likadant som Task 5 Step 2: läs `id` från `params`, hämta med `getEventById`, `notFound()` om saknas, ta bort `getActiveEvent`-import. Behåll resten (skickar redan `event.id` ner i formulär efter fas 1).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/admin
git commit -m "feat: admin-inställningar event-scopeade på /admin/events/[id]/settings"
```

### Task 7: Flytta Resultat till `/admin/events/[id]/results`

**Files:**
- Create: `app/admin/events/[id]/results/page.tsx` (från `app/admin/results/page.tsx`)

- [ ] **Step 1:** `git mv app/admin/results/page.tsx app/admin/events/[id]/results/page.tsx`

- [ ] **Step 2:** Byt event-resolution likadant som Task 5 Step 2 (`params.id` → `getEventById` → `notFound`, ta bort `getActiveEvent`-import).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/admin
git commit -m "feat: admin-resultat event-scopeade på /admin/events/[id]/results"
```

### Task 8: Gör admin-headern kontextuell

**Files:**
- Modify: `components/admin/admin-header.tsx`

- [ ] **Step 1:** Härled eventId ur pathen och bygg scopeade flikar. Ersätt `TABS`-konstanten och navigeringen:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/app/admin/actions";

export function AdminHeader() {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Matchar /admin/events/<id>/... → fånga id:t.
  const m = pathname.match(/^\/admin\/events\/([^/]+)/);
  const eventId = m ? m[1] : null;

  const eventTabs = eventId
    ? [
        { href: `/admin/events/${eventId}`, label: "Översikt" },
        { href: `/admin/events/${eventId}/settings`, label: "Inställningar" },
        { href: `/admin/events/${eventId}/results`, label: "Resultat" },
      ]
    : [];

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex h-14 items-center justify-between">
          <span className="flex items-center gap-2 font-display font-bold text-pitch">
            <span aria-hidden>⚙️</span> Admin
          </span>
          <div className="flex items-center gap-2">
            <Link href="/admin/events" className="text-sm text-muted hover:text-pitch">
              Alla event
            </Link>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => adminLogout())}
              className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:text-lose"
            >
              Logga ut
            </button>
          </div>
        </div>
        {eventTabs.length > 0 && (
          <nav className="flex items-center gap-1 pb-2">
            <Link
              href="/admin/events"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-cream-deep"
            >
              ← Alla event
            </Link>
            {eventTabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-pitch text-chalk" : "text-muted hover:bg-cream-deep",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
```

Not: "Se deltagarvy"-länken (tidigare mot `/`) tas bort här; deltagarvyn nås nu per event via event-listans "Visa"-länk (`/events/[slug]`). Behåll den om du hellre vill — men den kan inte längre peka rätt utan slug.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/admin/admin-header.tsx
git commit -m "feat: kontextuell admin-header med event-scopeade flikar"
```

### Task 9: Fas 2 browser-verifiering

- [ ] **Step 1:** Logga in som admin, gå till `/admin` → ska redirecta till `/admin/events`. Klicka "Hantera" på **VM-finalen 2026** → `/admin/events/<id>` ska visa **alla 13 spel**. Byt till Inställningar och Resultat via flikarna — samma event hela vägen. Gå tillbaka via "← Alla event", välj **Test-ligan** → visar dess (tomma) tillstånd. Bekräfta att event-valet nu styrs av URL:en, oberoende av skapelseordning.

---

## FAS 3 — Deltagare event-scopeade routes + ny rot

Mål: flytta tipsning/leaderboard/mina-tips under `/events/[slug]/…`, gör `/` till landning, uppdatera länkar.

### Task 10: Flytta tipsningen till `/events/[slug]/play`

**Files:**
- Create: `app/events/[slug]/play/page.tsx` (från `app/page.tsx`)

- [ ] **Step 1:** `git mv app/page.tsx app/events/[slug]/play/page.tsx`

- [ ] **Step 2:** Byt event-resolution. Ersätt `const event = await getActiveEvent();` med slug-baserad hämtning:

```ts
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/queries";
// ta bort getActiveEvent ur importlistan

export default async function PlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event || event.status === "draft") notFound();
  // ... resten av kroppen oförändrad; skickar redan event.id / eventId vidare
```

Uppdatera `revalidatePath`-strängar som pekar på `/` i denna renderingsväg om några finns; sidnivåns rendering är `force-dynamic` så ingen extra åtgärd krävs.

- [ ] **Step 3:** Uppdatera `submitBets`-anropet i tipsnings-UI:t så `eventId` = detta events id (redan gjort i fas 1 Task 1 Step 4; verifiera att propet nu kommer från `getEventBySlug`-eventet).

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. (Roten `/` saknas tillfälligt tills Task 13 — bygget klarar det, men skapa gärna Task 13 direkt efter.)

- [ ] **Step 5: Commit**

```bash
git add app/events app/page.tsx
git commit -m "feat: tipsning event-scopead på /events/[slug]/play"
```

### Task 11: Flytta leaderboard till `/events/[slug]/leaderboard`

**Files:**
- Create: `app/events/[slug]/leaderboard/page.tsx` (från `app/leaderboard/page.tsx`)

- [ ] **Step 1:** `git mv app/leaderboard/page.tsx app/events/[slug]/leaderboard/page.tsx`

- [ ] **Step 2:** Byt event-resolution till slug-baserad, exakt som Task 10 Step 2 (`params.slug` → `getEventBySlug` → `notFound` om saknas/draft, ta bort `getActiveEvent`-import). Behåll resten.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/events app/leaderboard
git commit -m "feat: leaderboard event-scopead på /events/[slug]/leaderboard"
```

### Task 12: Flytta mina-tips till `/events/[slug]/my-bets`

**Files:**
- Create: `app/events/[slug]/my-bets/page.tsx` (från `app/my-bets/page.tsx`)

- [ ] **Step 1:** `git mv app/my-bets/page.tsx app/events/[slug]/my-bets/page.tsx`

- [ ] **Step 2:** Byt event-resolution till slug-baserad, exakt som Task 10 Step 2. Behåll resten.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/events app/my-bets
git commit -m "feat: mina-tips event-scopead på /events/[slug]/my-bets"
```

### Task 13: Ny landningsrot `/`

**Files:**
- Create: `app/page.tsx` (ny landningssida)

- [ ] **Step 1:** Skapa en landningsrot som visar plattformsintrot och länkar till `/events`. Återanvänd intro-copyn som idag ligger överst i `app/events/page.tsx`:

```tsx
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { AuthNav } from "@/components/auth/auth-nav";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <>
      <SiteHeader right={<AuthNav />} />
      <main className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <h1 className="font-display text-4xl font-bold text-pitch">Tävla med dina vänner</h1>
        <p className="mt-3 text-lg text-muted">
          En plattform för att tippa och tävla kring event – från VM-finaler till Crossfit Games.
          Skapa ett gratis konto, anslut dig till ett event och klättra på leaderboarden.
        </p>
        <Link
          href="/events"
          className="mt-6 inline-block rounded-[var(--radius-pill)] bg-grass px-6 py-3 font-medium text-chalk hover:bg-grass-bright"
        >
          Se alla event →
        </Link>
      </main>
    </>
  );
}
```

- [ ] **Step 2:** Ta bort den nu dubblerade intro-`<section>` överst i `app/events/page.tsx` (rad ~19-33) så listan blir renodlad; behåll `<h2>Aktuella event</h2>` och listan.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/events/page.tsx
git commit -m "feat: rot / blir plattformslandning, event-intro flyttad från /events"
```

### Task 14: Uppdatera deltagarlänkar till event-scopeade URL:er

**Files (från `grep` i self-review):**
- Modify: `app/events/[slug]/page.tsx` — medlemskortets "Till tipsningen →" + `next`-params
- Modify: `components/site-header.tsx` — ev. leaderboard/`/`-länkar
- Modify: `app/account/page.tsx` — ev. länkar till `/leaderboard` / `/my-bets`
- (Redan hanterat: `components/admin/admin-header.tsx` i Task 8)

- [ ] **Step 1:** I `app/events/[slug]/page.tsx`, medlemskortet: byt `<Link href="/">Till tipsningen →</Link>` till `<Link href={`/events/${event.slug}/play`}>Till tipsningen →</Link>`.

- [ ] **Step 2:** Gå igenom deltagar-navigeringens länkar:

Run: `grep -n '"/leaderboard"\|"/my-bets"\|href="/"' components/site-header.tsx app/account/page.tsx`
Expected: notera varje träff. Byt varje leaderboard/mina-tips-länk till event-scopead form (`/events/${slug}/leaderboard`, `/events/${slug}/my-bets`) i komponenter som har `slug` i kontext. Länkar utan slug (t.ex. en global header) pekas om till `/events` eller döljs utanför event-kontext. `href="/"` (hem) får peka kvar på landningsroten.

- [ ] **Step 3:** Uppdatera `next=/`-referenser i `app/events/[slug]/page.tsx` register/login-länkar (`?next=/events/${event.slug}` finns redan för de flesta) så inget pekar på borttagen tipsnings-rot.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app components
git commit -m "feat: deltagarlänkar pekar på event-scopeade URL:er"
```

### Task 15: Fas 3 browser-verifiering

- [ ] **Step 1:** Utloggad: `/` visar landningen → "Se alla event" → `/events` listar event. Öppna **VM-finalen 2026** → `/events/final-2026`. Gå med (eller som befintlig deltagare), klicka "Till tipsningen" → `/events/final-2026/play` visar tipsningen med rätt spel. Lägg ett tips → sparas. Öppna `/events/final-2026/leaderboard` och `/events/final-2026/my-bets` → rätt event-data. Bekräfta att `submitBets` avvisas för fel event (t.ex. manuellt anropa med annat eventId, eller testa stängt event → "Tipsningen är stängd").

---

## FAS 4 — Städning & regressionsskydd

### Task 16: Ta bort `getActiveEvent` och gamla routes

**Files:**
- Modify: `lib/queries.ts` (ta bort `getActiveEvent`)
- Delete: tomma gamla route-mappar om kvar (`app/leaderboard`, `app/my-bets`, `app/admin/settings`, `app/admin/results` — `git mv` tog filerna men kolla att mapparna är borta)

- [ ] **Step 1: Verifiera att inget använder `getActiveEvent`**

Run: `grep -rn "getActiveEvent" app lib components`
Expected: bara definitionen i `lib/queries.ts` (rad 115-119).

- [ ] **Step 2:** Ta bort `getActiveEvent`-funktionen (rad 115-119) i `lib/queries.ts`.

- [ ] **Step 3:** Ta bort ev. kvarvarande oanvänd kod som fas 1 lämnade: `createEvent`, `createGamesForEvent`, `slugify` i `app/admin/actions.ts` om `npm run lint` flaggar dem som oanvända. (Behåll `createPlatformEvent`/`createEventAction`.)

- [ ] **Step 4:** Städa `revalidateAdmin()` och `submitBets`-revalidering: byt föråldrade sökvägar (`/admin/settings`, `/admin/results`, `/`, `/my-bets`, `/leaderboard`) mot de nya. Eftersom sidorna är `force-dynamic` räcker det att peka om till `/admin/events` respektive `revalidatePath("/events", "layout")`; enklast är att låta `revalidateAdmin` revalidera `/admin/events` och event-sidorna via `revalidatePath("/events/[slug]/play", "page")`-motsvarigheter. Håll det minimalt — ta bort strängar som pekar på borttagna routes.

- [ ] **Step 5: Full verifiering**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS, inga oanvända-import-varningar.

Run: `grep -rn "getActiveEvent" app lib components`
Expected: **noll träffar.**

- [ ] **Step 6: Commit**

```bash
git add lib/queries.ts app/admin/actions.ts app/actions.ts
git commit -m "chore: ta bort getActiveEvent — event kommer nu alltid från URL:en"
```

### Task 17: Slutverifiering (hela flödet)

- [ ] **Step 1:** Kör hela regressionssviten manuellt i browsern:
  - Admin: `/admin` → lista → välj två olika event → rätt spel/tillstånd per event, oberoende av skapelseordning. VM-finalen visar 13 spel.
  - Öppna/stäng betting, spara facit, settla paket, sätt betalning — allt mot rätt event.
  - Deltagare: `/` → `/events` → event → play/leaderboard/my-bets, lägg tips, se ställning.
  - `submitBets` mot stängt/fel event avvisas.
- [ ] **Step 2:** `npm run test` (scoring-sviten ska fortsatt passera — orörd).
- [ ] **Step 3:** Bekräfta att inga döda topp-nivå-routes svarar: `/leaderboard`, `/my-bets`, `/admin/settings`, `/admin/results` ska ge 404.

---

## Self-review-noteringar (för implementeraren)

- Om en task hittar en anropare som inte nämns explicit (t.ex. en banner-komponent som länkar till `/`), följ samma mönster: event-scopead länk om `slug` finns i kontext, annars flytta in i event-layouten.
- `joinEvent` och `savePlayers` tar redan `eventId` — rör inte deras signaturer.
- Fotbolls-("match")-eventets settings-formulär (`saveEventSettings`) uppdaterar nu bara befintligt event; nya event skapas via event-listan.
- Håll varje commit byggbar. Om en task lämnar ett rött mellan-tillstånd (Task 2), commit:a först efter den task som gör det grönt igen (Task 3).
