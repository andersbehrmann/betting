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
