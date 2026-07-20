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
  // computeSettlement vägrar räkna på en obalanserad sammanställning – hellre en
  // synlig varning än en uträkning som tyst pekar ut fel person som vinnare.
  let transfers;
  try {
    transfers = computeSettlement(participants);
  } catch (err) {
    if (viewerId) return null;
    return (
      <Card className="p-4">
        <h2 className="font-display text-lg font-bold text-lose">Sammanräkningen går inte ihop</h2>
        <p className="mt-1 text-sm text-muted">
          {err instanceof Error ? err.message : "Okänt fel."}
        </p>
      </Card>
    );
  }

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
