# ⚽ Tipskvällen – privat bettinglek

En liten, mobilanpassad webbapp för en privat bettinglek i samband med en fotbollsfinal.
Tänkt för ~10–12 vänner under en kväll – småsummor, en gemensam länk, ingen kommersiell betting.

Deltagarna öppnar appen, skriver sitt namn, väljer vilka spel de vill vara med i, lägger sina
tips, ser sin totala insats och skickar in före matchstart. Efteråt ser de vilka spel de vann
och hur mycket de får tillbaka. Admin konfigurerar matchen, öppnar/stänger bettingen, lägger in
facit efterhand och låter systemet räkna ut vinnare och utbetalningar.

## Funktioner

**Deltagare**
- Gå med med bara ett namn (unik `access_token` sparas i cookie – återvänd på samma enhet)
- Match-banner med live-nedräkning till tipsstopp
- Välj spel med stora klickytor, se insats/spel och löpande totalsumma
- Bekräfta totala insatsen innan inskick
- Kvitto på `/my-bets` med insats, vinst, netto och betalningsstatus
- Resultattavla på `/leaderboard` (när admin gör den synlig)

**Admin** (`/admin`, lösenordsskyddad)
- Skapa/konfigurera event: lag, tider, valuta, insatser, stjärnspelare m.m.
- Öppna/stänga betting manuellt (utöver automatisk låsning vid deadline)
- Aktivera/inaktivera enskilda spel, hantera spelarlista
- Lägg in facit successivt per spel → automatisk vinnar- och utbetalningsuträkning
- Se pott, antal deltagare och svarsfördelning per spel
- Återöppna/korrigera facit, samt **manuell justering** av vinnare (markeras tydligt)
- Slutsammanställning per deltagare + betalningsstatus (ej betalat / betalat / slutreglerat)
- Enkel **audit-logg** – inget resultat raderas tyst

## De 12 spelen + matchpaketet

Världsmästare · Resultat efter 90 min · Första målskytt · Tid för första målet · Förlängning ·
Straffläggning · Första gula kortet · Totalt antal gula kort · Straff under matchen · VAR-underkänt
mål · Första gråtande supportern · Kommentatorn nämner stjärnspelaren.

**Matchpaketet** är ett separat jackpotspel: tippa världsmästare, resultat, första målskytt och
förlängning – 1 poäng per rätt del, flest poäng delar potten. En knapp kopierar deltagarens
ordinarie svar till paketet. Exakt resultat kan användas som utslagsfråga (närmast vinner).

## Teknisk stack

- **Next.js 16** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** (egna, lättviktiga UI-komponenter)
- **Neon** (serverless Postgres) via `@neondatabase/serverless`
- **Zod** för server-side validering, **date-fns-tz** för Europe/Stockholm
- **Vitest** för enhetstester av vinstberäkningen
- Deploybar på **Vercel**

### Arkitektur

All databasåtkomst sker **server-side** (server actions / server components) med Neons
connection string. Auktorisering sker i app-lagret:

- **Deltagare** identifieras med en slumpad `access_token` i en httpOnly-cookie och kan bara
  läsa/ändra sina egna tips – och bara före deadline.
- **Admin** loggar in med `ADMIN_PASSWORD`; sessionen är en HMAC-signerad httpOnly-cookie.

Klienten pratar aldrig direkt med databasen, så Postgres-RLS behövs inte – "RLS-kravet" uppfylls
som app-lager-auktorisering. Inga hemligheter finns i frontend-koden.

## Kom igång lokalt

Krav: Node 20+ och ett Neon-projekt (gratisnivån räcker).

```bash
# 1. Installera beroenden
npm install

# 2. Skapa .env.local från mallen och fyll i värden
cp .env.example .env.local
```

Fyll i `.env.local`:

| Variabel | Beskrivning |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string (Dashboard → Connect → Pooled connection) |
| `ADMIN_PASSWORD` | Lösenord för `/admin` |
| `SESSION_SECRET` | Lång slumpsträng: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` lokalt |

```bash
# 3. Kör migrationer + seed-data mot Neon
npm run db:migrate
npm run db:seed

# 4. Starta dev-servern
npm run dev
```

Öppna http://localhost:3000 (deltagarvy) och http://localhost:3000/admin (adminlösenord).

### npm-scripts

| Script | Gör |
|---|---|
| `npm run dev` | Startar Next.js dev-server |
| `npm run build` / `npm start` | Produktionsbygge / -körning |
| `npm test` | Kör vinstberäkningens enhetstester (Vitest) |
| `npm run db:migrate` | Kör ej applicerade SQL-migrationer (`db:migrate -- --reset` bygger om från noll) |
| `npm run db:seed` | Fyller på exempel-event, spelare, spel och deltagare |
| `npm run db:reset` | `--reset`-migrering + seed |

## Datamodell

`events`, `players`, `participants`, `games`, `bets`, `game_winners`, `audit_log`.
Se [`db/migrations/0001_init.sql`](db/migrations/0001_init.sql). Spelsvar och facit lagras som
`jsonb` (`answer_data` / `result_data`) eftersom varje speltyp har olika struktur.

## Vinstberäkning

Ren, testbar domänlogik i [`lib/scoring/`](lib/scoring):

- **Pott** = antal deltagare i spelet × insatsen. Vinnare delar potten lika.
- **Resultat efter 90 min**: exakt rätt vinner; annars (om admin valt "närmast") rangordning på
  lägst total avvikelse → rätt målskillnad → rätt totalt antal mål → annars delad vinst.
- **Matchpaketet**: 1 poäng per rätt del; flest poäng delar potten; exakt resultat som utslag.
- Beräkning sker i decimaler, visning i kronor med 2 decimaler. Vid ojämn delning kan en liten
  öresdifferens uppstå (t.ex. 20 kr / 3 = 6,67 kr × 3 = 20,01 kr) – admin kan justera manuellt.

Alla vinstberäkningar körs om automatiskt varje gång admin ändrar facit.

Kör testerna:

```bash
npm test
```

## Deploy till Vercel

1. Pusha repot till GitHub (konfigurerat mot `github.com/andersbehrmann/betting`).
2. I Vercel: **Add New → Project** och importera GitHub-repot.
3. Sätt miljövariabler i Vercel (Project → Settings → Environment Variables):
   `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`
   (sätt `NEXT_PUBLIC_APP_URL` till din produktions-URL).
4. Deploya. Migrationer/seed körs inte automatiskt – kör dem mot Neon en gång från din dator:
   ```bash
   npm run db:migrate   # med produktionens DATABASE_URL i .env.local
   ```
   (Kör `npm run db:seed` bara om du vill ha exempeldata i produktion.)

## Antaganden & noteringar

- **Ett event i taget** stöds i UI:t (senast skapade event är aktivt), men datamodellen är
  `event_id`-scopad och förberedd för flera event.
- Alla tider hanteras i **Europe/Stockholm**. Tider lagras som `timestamptz` (UTC) och tolkas/
  visas i Stockholmstid i gränssnittet.
- Deltagarnamn måste vara unikt inom ett event (case-insensitive).
- Betting låses automatiskt vid deadline (server-side kontroll vid varje inskick) och kan låsas
  tidigare manuellt av admin. Efter låsning är tipsen skrivskyddade.
- Ett spel kostar bara pengar om deltagaren aktivt valt det.
- **Säkerhet:** Om Neon-lösenordet delats i klartext under utvecklingen – rotera det i Neon-panelen
  och uppdatera `DATABASE_URL` i `.env.local` och Vercel.
