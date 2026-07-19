// Bygger serialiserbara "vyer" av spel för klientkomponenter.
// Ren modul – ingen DB, ingen server-only. Kan importeras överallt.

import { GAME_DEFINITIONS, getGameDefinition, SCORER_OWN_GOAL, SCORER_NONE } from "./scoring/games";
import type { GameInputKind } from "./scoring/types";

export interface OptionView {
  value: string;
  label: string;
}

export interface GameView {
  id: string;
  gameKey: string;
  title: string;
  description: string | null;
  stake: number;
  isJackpot: boolean;
  inputKind: GameInputKind;
  options: OptionView[];
}

export interface GameLite {
  id: string;
  gameKey: string;
  title: string;
  description: string | null;
  stake: number;
  isJackpot: boolean;
  isCustom?: boolean;
  options?: OptionView[] | null;
}

export interface PlayerLite {
  id: string;
  name: string;
  team: 1 | 2;
}

export function buildGameView(
  game: GameLite,
  players: PlayerLite[],
  teams: { one: string; two: string },
): GameView {
  // Custom-spel: alltid flerval, med egna alternativ från DB.
  if (game.isCustom) {
    return {
      id: game.id,
      gameKey: game.gameKey,
      title: game.title,
      description: game.description,
      stake: game.stake,
      isJackpot: game.isJackpot,
      inputKind: "option",
      options: game.options ?? [],
    };
  }

  const def = getGameDefinition(game.gameKey);
  const inputKind = def?.inputKind ?? "option";
  let options: OptionView[] = [];

  if (inputKind === "option" && def?.options) {
    options = def.options.map((o) => ({
      value: o.value,
      label: o.value === "team_one" ? teams.one : o.value === "team_two" ? teams.two : o.label,
    }));
  } else if (inputKind === "scorer") {
    options = [
      ...players.map((p) => ({ value: p.id, label: p.name })),
      { value: SCORER_OWN_GOAL, label: "Självmål" },
      { value: SCORER_NONE, label: "Ingen målskytt" },
    ];
  }

  return {
    id: game.id,
    gameKey: game.gameKey,
    title: game.title,
    description: game.description,
    stake: game.stake,
    isJackpot: game.isJackpot,
    inputKind,
    options,
  };
}

export function buildGameViews(
  games: GameLite[],
  players: PlayerLite[],
  teams: { one: string; two: string },
): GameView[] {
  return games.map((g) => buildGameView(g, players, teams));
}

/** Etikett för ett sparat svarsvärde (för kvitton/resultat). */
export function labelForValue(view: GameView, value: string): string {
  return view.options.find((o) => o.value === value)?.label ?? value;
}

export const ALL_GAME_KEYS = GAME_DEFINITIONS.map((g) => g.key);
