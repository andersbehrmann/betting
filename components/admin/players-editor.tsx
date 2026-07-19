"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Label, Textarea } from "@/components/ui";
import { savePlayers } from "@/app/admin/actions";

export function PlayersEditor({
  eventId,
  teamOneName,
  teamTwoName,
  initialTeam1,
  initialTeam2,
}: {
  eventId: string;
  teamOneName: string;
  teamTwoName: string;
  initialTeam1: string[];
  initialTeam2: string[];
}) {
  const router = useRouter();
  const [t1, setT1] = useState(initialTeam1.join("\n"));
  const [t2, setT2] = useState(initialTeam2.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function parse(text: string): string[] {
    return text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const count = parse(t1).length + parse(t2).length;

  function onSave() {
    setError(null);
    setSaved(false);
    const players = [
      ...parse(t1).map((name) => ({ name, team: 1 as const })),
      ...parse(t2).map((name) => ({ name, team: 2 as const })),
    ];
    startTransition(async () => {
      const res = await savePlayers(eventId, players);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-pitch">Spelarlista (målskyttar)</h2>
      <p className="mt-1 text-sm text-muted">Ett namn per rad. Används i spelet ”Första målskytt” och matchpaketet.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <Label>{teamOneName || "Lag 1"}</Label>
          <Textarea rows={8} value={t1} onChange={(e) => setT1(e.target.value)} placeholder={"Spelare A\nSpelare B"} />
        </div>
        <div>
          <Label>{teamTwoName || "Lag 2"}</Label>
          <Textarea rows={8} value={t2} onChange={(e) => setT2(e.target.value)} placeholder={"Spelare C\nSpelare D"} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-lose">{error}</p>}
      {saved && <p className="mt-2 text-sm text-grass">✓ Sparat.</p>}
      <Button className="mt-3" disabled={isPending} onClick={onSave}>
        {isPending ? "Sparar…" : `Spara spelarlista (${count})`}
      </Button>
    </Card>
  );
}
