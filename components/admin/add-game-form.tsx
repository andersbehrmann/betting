"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { addCustomGame } from "@/app/admin/actions";

export function AddGameForm({ eventId, defaultStake }: { eventId: string; defaultStake: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stake, setStake] = useState(defaultStake);
  const [optionsText, setOptionsText] = useState("");
  const [bettingOpen, setBettingOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setStake(defaultStake);
    setOptionsText("");
    setBettingOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const options = optionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (options.length < 2) {
      setError("Ange minst 2 svarsalternativ (ett per rad).");
      return;
    }
    startTransition(async () => {
      const res = await addCustomGame(eventId, {
        title,
        description: description || null,
        stake: Number(stake),
        bettingOpen,
        options,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Card className="p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-dashed border-grass/60 bg-grass/5 px-4 py-3 text-sm font-medium text-grass hover:bg-grass/10"
        >
          + Lägg till ett eget spel
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-pitch">Nytt eget spel</h2>
      <p className="mt-1 text-sm text-muted">
        Skapa ett flervalsspel med egna svarsalternativ – kan läggas till när som helst.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <Label>Titel</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="t.ex. Vem blir matchens lirare?" required />
        </div>
        <div>
          <Label>Beskrivning (valfritt)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Insats</Label>
            <Input type="number" min={0} step="0.5" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setBettingOpen((v) => !v)}
              className="mb-0.5 flex h-12 w-full items-center gap-2 rounded-xl border border-line bg-cream px-3 text-sm"
            >
              <span aria-hidden>{bettingOpen ? "🟢" : "🔒"}</span>
              {bettingOpen ? "Öppet för tips direkt" : "Skapas stängt"}
            </button>
          </div>
        </div>
        <div>
          <Label>Svarsalternativ (ett per rad)</Label>
          <Textarea
            rows={4}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={"Ja\nNej\nKanske"}
          />
        </div>
        {error && <p className="text-sm text-lose">{error}</p>}
        <div className="flex gap-2">
          <Button variant="ghost" type="button" className="flex-1" onClick={() => setOpen(false)} disabled={isPending}>
            Avbryt
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Skapar…" : "Skapa spel"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
