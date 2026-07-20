import { describe, it, expect } from "vitest";
import { isGameBettable, isGloballyOpen } from "../lib/betting";
import type { EventRow, GameRow } from "../lib/types";

function makeEvent(over: Partial<EventRow> = {}): EventRow {
  return {
    bettingOpen: true,
    bettingDeadline: null,
    joinFeeCents: 0,
    eventType: "betting",
    status: "open",
    ...over,
  } as EventRow;
}

function makeGame(over: Partial<GameRow> = {}): Pick<GameRow, "active" | "status" | "bettingOpen"> {
  return { active: true, status: "open", bettingOpen: true, ...over };
}

describe("isGloballyOpen", () => {
  it("är öppen utan deadline (generiska event saknar tipsstopp)", () => {
    expect(isGloballyOpen(makeEvent({ bettingDeadline: null }))).toBe(true);
  });

  it("stänger när deadline passerat", () => {
    const past = new Date(Date.now() - 1000);
    expect(isGloballyOpen(makeEvent({ bettingDeadline: past }))).toBe(false);
  });

  it("respekterar master-switchen oavsett deadline", () => {
    expect(isGloballyOpen(makeEvent({ bettingOpen: false }))).toBe(false);
  });
});

describe("isGameBettable", () => {
  it("öppet, aktivt spel går att tippa på", () => {
    expect(isGameBettable(makeGame(), makeEvent())).toBe(true);
  });

  // Kärnan i spelförslag: godkända förslag blir utkast och får ALDRIG gå live
  // förrän admin publicerar dem.
  it("utkast går aldrig att tippa på", () => {
    expect(isGameBettable(makeGame({ status: "draft" }), makeEvent())).toBe(false);
  });

  it("utkast är stängt även om det råkar vara aktivt och öppet", () => {
    expect(
      isGameBettable(makeGame({ status: "draft", active: true, bettingOpen: true }), makeEvent()),
    ).toBe(false);
  });

  it("avgjort spel går inte att tippa på", () => {
    expect(isGameBettable(makeGame({ status: "settled" }), makeEvent())).toBe(false);
  });

  it("inaktivt spel går inte att tippa på", () => {
    expect(isGameBettable(makeGame({ active: false }), makeEvent())).toBe(false);
  });

  it("per-spel-stopp respekteras", () => {
    expect(isGameBettable(makeGame({ bettingOpen: false }), makeEvent())).toBe(false);
  });

  it("globalt stopp slår igenom på enskilt spel", () => {
    expect(isGameBettable(makeGame(), makeEvent({ bettingOpen: false }))).toBe(false);
  });
});
