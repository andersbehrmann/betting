# Event-scopead routing — design

**Datum:** 2026-07-19
**Branch:** plattform
**Status:** Godkänd design, redo för implementationsplan

## Bakgrund & problem

Appen byggdes ursprungligen för *ett enda* event ("kvällens match"). Överallt där koden
behöver veta vilket event som avses används `getActiveEvent()`:

```sql
SELECT * FROM events WHERE team_one IS NOT NULL ORDER BY created_at DESC LIMIT 1
```

Det vill säga "det senast skapade betting-eventet". När plattformen nu byggs ut till flera
event (och databasen dessutom delas mellan git-branchar) landar admin och deltagarvyer på
fel event — t.ex. ett tomt testevent skapat i en parallell branch — vilket får det att se ut
som att spelen försvunnit.

`getActiveEvent()` används på båda sidor:

- **Admin:** Översikt (`/admin`), Inställningar, Resultat + 6 anrop i `app/admin/actions.ts`
- **Deltagare:** startsidan `/`, `/leaderboard`, `/my-bets` + `submitBets` i `app/actions.ts`
  (`joinEvent` tar redan `eventId`)

## Mål

- Vilket event som avses ska **alltid komma från URL:en**, aldrig gissas.
- Admin kan hantera valfritt event via event-scopeade URL:er.
- Deltagarvyer (tipsning, leaderboard, mina tips) är per event.
- Roten `/` blir en plattformslandning utan event-gissning.
- `getActiveEvent()` tas bort när inget använder den.

## Icke-mål (YAGNI)

- Ingen ändring av datamodellen/tabellerna — schemat stödjer redan flera event.
- Ingen Stripe-/betalningslogik (egen fas).
- Ingen ny behörighetsmodell utöver befintlig admin/medlemskap.
- Ingen migrering av gammal data.

## Grundprincip: explicit event överallt

Kärnfixen. Eventet resolvas från URL-parametern i varje route och skickas explicit ner i
queries och server actions.

- Admin-routes läser `[id]` → `getEventById(id)`; 404 om eventet saknas.
- Deltagar-routes läser `[slug]` → `getEventBySlug(slug)`; 404 om det saknas eller är `draft`.
- **Server actions tar `eventId` som argument** i stället för att internt kalla `getActiveEvent()`.
- `getActiveEvent()` raderas ur `lib/queries.ts` när sista anropet är borta. Detta är
  regressions-skyddet: efter borttagningen är det omöjligt för en vy att råka gissa event igen.

### Säkerhet (obligatoriskt)

När `eventId` blir ett klient-inskickat argument skyddar inte längre "det enda eventet"
implicit. Varje action måste verifiera behörighet mot *det angivna* eventet:

- **Admin-actions** (`saveResult`, öppna/stäng spel, event-inställningar osv): kräver
  `isAdmin()` — som idag, men behörigheten gäller nu det inskickade `eventId`.
- **`submitBets`:** måste verifiera att inloggad användare är **medlem i `eventId`** och att
  eventet är **öppet för betting** innan tipsen sparas. Idag garanterades detta av att bara
  ett event fanns; nu måste det kontrolleras explicit, annars kan en användare posta mot ett
  event de inte gått med i eller mot ett stängt event.
- Alla `eventId`/`slug` från URL eller formulär behandlas som otrodd indata: slå upp i DB,
  404/avvisa om det inte matchar en tillåten rad.

## Admin — event-scopeat

```
/admin                      → redirect till /admin/events
/admin/events               → lista + skapa event   (finns redan)
/admin/events/[id]          → Översikt   (dagens /admin/page.tsx flyttas hit)
/admin/events/[id]/settings → Inställningar
/admin/events/[id]/results  → Resultat
```

- Nuvarande `app/admin/page.tsx` (Översikt) flyttas till `app/admin/events/[id]/page.tsx` och
  läser eventet via `getEventById(id)` i stället för `getActiveEvent()`.
- `app/admin/settings/page.tsx` → `app/admin/events/[id]/settings/page.tsx`.
- `app/admin/results/page.tsx` → `app/admin/events/[id]/results/page.tsx`.
- `app/admin/page.tsx` blir en enkel redirect till `/admin/events`.
- **Admin-headern** (`components/admin/admin-header.tsx`) blir kontextuell:
  - Utanför ett event (på `/admin/events`): visa bara rubrik + "Logga ut" (event-listan är innehållet).
  - Inne i ett event: visa flikarna **Översikt / Inställningar / Resultat** med `href` scopeade
    till `/admin/events/[id]/...`, plus en "← Alla event"-länk tillbaka till listan.
  - Eftersom headern är en klientkomponent läses `[id]` ur `usePathname()` (eller skickas som prop).
- `AdminControls`, `GameAdminCard` och resultatformulären får `eventId` som prop och skickar det
  vidare till respektive server action.
- Event-listan (`/admin/events`) länkar varje event till `/admin/events/[id]`.

## Deltagare — event-scopeat + ny rot

```
/                          → landningssida (plattformsintro + "Se alla event")
/events                    → bläddra event   (finns redan)
/events/[slug]             → landning/gå med  (finns redan)
/events/[slug]/play        → tipsningen  (flyttas från dagens app/page.tsx)
/events/[slug]/leaderboard → resultattavla per event
/events/[slug]/my-bets     → mina tips per event
```

- **Roten `/`** slutar använda `getActiveEvent`. Den blir plattformens hem: introtexten som idag
  ligger överst på `/events`, plus en tydlig väg in till `/events`. (Intro-sektionen kan flyttas
  från `/events` till `/` så listan blir renodlad, eller dupliceras lätt — avgörs i planen.)
- **`/events/[slug]/play`** är dagens tipsnings-UI från `app/page.tsx`, men eventet kommer från
  `slug` och all data-hämtning scopeas till `event.id`.
- **`/events/[slug]/leaderboard`** och **`/events/[slug]/my-bets`** ersätter globala
  `/leaderboard` och `/my-bets`. De gamla topp-nivå-routsen tas bort.
- Länkar uppdateras:
  - `/events/[slug]/page.tsx`: medlemskortets "Till tipsningen →" pekar på `/events/[slug]/play`.
  - Deltagar-header/nav: leaderboard-/mina-tips-länkar blir per event (bara synliga i event-kontext).
  - `register`/`login`-`next`-parametrar som pekar på `/` uppdateras vid behov.
- Route-namn hålls engelska (`play` / `leaderboard` / `my-bets`) för konsekvens med resten av koden.

## Berörda filer (översikt)

**Flyttas:**
- `app/admin/page.tsx` → `app/admin/events/[id]/page.tsx` (+ ny `/admin/page.tsx` som redirect)
- `app/admin/settings/page.tsx` → `app/admin/events/[id]/settings/page.tsx`
- `app/admin/results/page.tsx` → `app/admin/events/[id]/results/page.tsx`
- `app/page.tsx` (tipsning) → `app/events/[slug]/play/page.tsx` (+ ny landnings-`/`)
- `app/leaderboard/page.tsx` → `app/events/[slug]/leaderboard/page.tsx`
- `app/my-bets/page.tsx` → `app/events/[slug]/my-bets/page.tsx`

**Ändras:**
- `lib/queries.ts` — ta bort `getActiveEvent`; behåll `getEventById` / `getEventBySlug`.
- `app/actions.ts` — `submitBets` tar `eventId`, med medlemskaps-/öppet-kontroll.
- `app/admin/actions.ts` — de 6 anropen tar `eventId`, med admin-kontroll mot eventet.
- `components/admin/admin-header.tsx` — kontextuella, scopeade flikar.
- `components/admin/admin-controls.tsx`, `game-admin-card.tsx` — `eventId` som prop.
- Deltagar-header/nav-komponenter + länkar (medlemskort, register/login `next`).

## Testning / verifiering

- Skapa ≥2 event (ett med spel, ett tomt) och verifiera att admin visar rätt event per URL,
  oberoende av skapelseordning.
- Verifiera att `/admin/events/[id]` för "VM-finalen 2026" visar alla 13 spel.
- Verifiera att `placeBet` avvisas när användaren inte är medlem i eventet respektive när
  eventet är stängt.
- Verifiera deltagarflöde: `/` → `/events` → `/events/[slug]` → `/events/[slug]/play`, samt
  leaderboard/mina-tips per event.
- Verifiera att inga referenser till `getActiveEvent` finns kvar (grep).

## Faser (för implementationsplanen)

1. **Grund:** ge server actions `eventId`-argument + behörighetskontroller; lägg till
   `getEventById`-baserad resolution. (Ingen route flyttas än; anropas med nuvarande event.)
2. **Admin-routes:** flytta Översikt/Inställningar/Resultat under `/admin/events/[id]/...`,
   gör headern kontextuell, `/admin` → redirect.
3. **Deltagar-routes:** flytta tipsning/leaderboard/mina-tips under `/events/[slug]/...`,
   gör `/` till landning, uppdatera länkar.
4. **Städning:** ta bort `getActiveEvent` och gamla topp-nivå-routes, grep-verifiera.
