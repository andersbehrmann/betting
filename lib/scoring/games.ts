// Deklarativa definitioner av de 12 ordinarie spelen + matchpaketet.
// Detta är sanningskällan som både seed och UI utgår från.

import type { GameDefinition, GameOption, GameKey } from "./types";
import { PACKAGE_GAME_KEY } from "./types";

// Speciella "målskytt"-värden utöver spelarlistan.
export const SCORER_OWN_GOAL = "own_goal";
export const SCORER_NONE = "none";

// Lag refereras med stabila nycklar; etiketter renderas från eventets lagnamn.
export const TEAM_ONE = "team_one";
export const TEAM_TWO = "team_two";

const FIRST_GOAL_TIME: GameOption[] = [
  { value: "1-15", label: "Minut 1–15" },
  { value: "16-30", label: "Minut 16–30" },
  { value: "31-45", label: "Minut 31–45+" },
  { value: "46-60", label: "Minut 46–60" },
  { value: "61-75", label: "Minut 61–75" },
  { value: "76-90", label: "Minut 76–90+" },
  { value: "extra_time", label: "Förlängning" },
  { value: "no_goal", label: "Inget mål" },
];

const CRYING_FAN: GameOption[] = [
  { value: "before_kickoff", label: "Före avspark" },
  { value: "first_half", label: "Första halvlek" },
  { value: "halftime", label: "Halvtid" },
  { value: "second_half", label: "Andra halvlek" },
  { value: "after_final", label: "Efter slutsignal" },
  { value: "none", label: "Ingen visas" },
];

const STAR_MENTION: GameOption[] = [
  { value: "before_kickoff", label: "Före avspark" },
  { value: "1-5", label: "Minut 1–5" },
  { value: "6-15", label: "Minut 6–15" },
  { value: "later", label: "Senare än minut 15" },
  { value: "not_mentioned", label: "Nämns inte" },
];

const YES_NO: GameOption[] = [
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nej" },
];

function teamOptions(extra: GameOption[] = []): GameOption[] {
  return [
    { value: TEAM_ONE, label: "Lag 1" },
    { value: TEAM_TWO, label: "Lag 2" },
    ...extra,
  ];
}

export const GAME_DEFINITIONS: GameDefinition[] = [
  {
    key: "world_champion",
    title: "Världsmästare",
    description: "Gäller inklusive förlängning och straffläggning.",
    inputKind: "option",
    options: teamOptions(),
    isJackpot: false,
    sortOrder: 1,
  },
  {
    key: "result_90",
    title: "Resultat efter 90 minuter",
    description:
      "Efter ordinarie tid inklusive tilläggstid, men före eventuell förlängning.",
    inputKind: "score",
    isJackpot: false,
    sortOrder: 2,
  },
  {
    key: "first_scorer",
    title: "Första målskytt",
    description: "Välj spelare, självmål eller ingen målskytt.",
    inputKind: "scorer",
    isJackpot: false,
    sortOrder: 3,
  },
  {
    key: "first_goal_time",
    title: "Tid för första målet",
    inputKind: "option",
    options: FIRST_GOAL_TIME,
    isJackpot: false,
    sortOrder: 4,
  },
  {
    key: "extra_time",
    title: "Blir det förlängning?",
    inputKind: "option",
    options: YES_NO,
    isJackpot: false,
    sortOrder: 5,
  },
  {
    key: "penalties_shootout",
    title: "Blir det straffläggning?",
    inputKind: "option",
    options: YES_NO,
    isJackpot: false,
    sortOrder: 6,
  },
  {
    key: "first_yellow",
    title: "Vilket lag får första gula kortet?",
    inputKind: "option",
    options: teamOptions([{ value: "none", label: "Inget gult kort" }]),
    isJackpot: false,
    sortOrder: 7,
  },
  {
    key: "total_yellows",
    title: "Totalt antal gula kort",
    description:
      "Standard: endast spelare på planen/i truppen räknas, inte ledare (kan ändras av admin).",
    inputKind: "option",
    options: [
      { value: "0-2", label: "0–2" },
      { value: "3-4", label: "3–4" },
      { value: "5-6", label: "5–6" },
      { value: "7plus", label: "7 eller fler" },
    ],
    isJackpot: false,
    sortOrder: 8,
  },
  {
    key: "penalty_awarded",
    title: "Döms det straff under matchen?",
    description: "Straffläggning räknas inte.",
    inputKind: "option",
    options: [
      { value: TEAM_ONE, label: "Ja, till lag 1" },
      { value: TEAM_TWO, label: "Ja, till lag 2" },
      { value: "both", label: "Ja, till båda lagen" },
      { value: "none", label: "Nej" },
    ],
    isJackpot: false,
    sortOrder: 9,
  },
  {
    key: "var_disallowed_goal",
    title: "Underkänns något mål efter VAR-granskning?",
    inputKind: "option",
    options: YES_NO,
    isJackpot: false,
    sortOrder: 10,
  },
  {
    key: "first_crying_fan",
    title: "När visas den första gråtande supportern?",
    inputKind: "option",
    options: CRYING_FAN,
    isJackpot: false,
    sortOrder: 11,
  },
  {
    key: "commentator_star_mention",
    title: "När nämner kommentatorn den utvalda stjärnspelaren?",
    inputKind: "option",
    options: STAR_MENTION,
    isJackpot: false,
    sortOrder: 12,
  },
  {
    key: PACKAGE_GAME_KEY,
    title: "Matchpaketet",
    description:
      "Jackpot: tippa världsmästare, resultat, första målskytt och förlängning. 1 poäng per rätt del.",
    inputKind: "package",
    isJackpot: true,
    sortOrder: 13,
  },
];

/** Delarna som ingår i matchpaketet, i visningsordning. */
export const PACKAGE_PARTS: GameKey[] = [
  "world_champion",
  "result_90",
  "first_scorer",
  "extra_time",
];

export function getGameDefinition(key: string): GameDefinition | undefined {
  return GAME_DEFINITIONS.find((g) => g.key === key);
}

/** Etikett för ett alternativ givet event-lagnamn (för team_one/team_two). */
export function optionLabel(
  def: GameDefinition,
  value: string,
  teams: { one: string; two: string },
): string {
  if (value === TEAM_ONE) return teams.one;
  if (value === TEAM_TWO) return teams.two;
  const opt = def.options?.find((o) => o.value === value);
  return opt?.label ?? value;
}
