// Rena domäntyper för bettinglekens spel. Ingen DB-kod här.

export type GameKey =
  | "world_champion"
  | "result_90"
  | "first_scorer"
  | "first_goal_time"
  | "extra_time"
  | "penalties_shootout"
  | "first_yellow"
  | "total_yellows"
  | "penalty_awarded"
  | "var_disallowed_goal"
  | "first_crying_fan"
  | "commentator_star_mention";

export const PACKAGE_GAME_KEY = "match_package" as const;
export type PackageGameKey = typeof PACKAGE_GAME_KEY;
export type AnyGameKey = GameKey | PackageGameKey;

// Hur deltagaren matar in sitt tips.
export type GameInputKind = "option" | "score" | "scorer" | "package";

export interface GameOption {
  value: string;
  label: string;
}

export interface GameDefinition {
  key: AnyGameKey;
  title: string;
  description?: string;
  inputKind: GameInputKind;
  /** Statiska val (för inputKind === "option"). "scorer" byggs dynamiskt av spelarlistan. */
  options?: GameOption[];
  isJackpot: boolean;
  sortOrder: number;
}

// --- Svarsformer (answer_data i JSONB) ---

/** De flesta spel: ett valt alternativ. */
export interface OptionAnswer {
  value: string;
}

/** result_90: antal mål per lag efter 90 min (+ tilläggstid). */
export interface ScoreAnswer {
  home: number;
  away: number;
}

/** Matchpaketet: återanvänder val från de ordinarie spelen. */
export interface PackageAnswer {
  world_champion?: string;
  result_90?: ScoreAnswer;
  first_scorer?: string;
  extra_time?: string;
}

export type Answer = OptionAnswer | ScoreAnswer | PackageAnswer;

// --- Facit-former (result_data i JSONB) ---
// Speglar answer-formerna. null = facit ej satt ännu.

export type OptionResult = OptionAnswer;
export type ScoreResult = ScoreAnswer;

/** Facit för matchpaketet – samlas ihop från de fyra deltagarnas ordinarie facit. */
export interface PackageResult {
  world_champion?: string;
  result_90?: ScoreAnswer;
  first_scorer?: string;
  extra_time?: string;
  /** Om exakt resultat ska användas som utslagsfråga. */
  tiebreak_exact?: boolean;
}

export type GameResult = OptionResult | ScoreResult | PackageResult;

/** Hur "närmast" hanteras för result_90 när ingen har exakt rätt. */
export type ClosestResultMode = "nearest" | "no_winner";
