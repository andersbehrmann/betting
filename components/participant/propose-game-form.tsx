"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { proposeGame } from "@/app/events/actions";

export function ProposeGameForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      const res = await proposeGame(eventId, {
        title,
        description: description || null,
        options,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTitle("");
      setDescription("");
      setOptionsText("");
      setOpen(false);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <Card className="p-4 text-center">
        <p className="text-sm font-medium text-grass">Tack! Ditt förslag har skickats.</p>
        <p className="mt-1 text-xs text-muted">
          Admin granskar det och lägger upp spelet om det passar.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-2 text-xs text-muted underline hover:text-pitch"
        >
          Föreslå ett till
        </button>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card className="p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-dashed border-grass/60 bg-grass/5 px-4 py-3 text-sm font-medium text-grass hover:bg-grass/10"
        >
          💡 Föreslå ett spel
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-pitch">Föreslå ett spel</h2>
      <p className="mt-1 text-sm text-muted">
        Admin granskar förslaget och bestämmer insats och om det ska läggas upp.
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <Label>Vad ska man tippa på?</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="t.ex. Vem tar första passningen?"
            required
          />
        </div>
        <div>
          <Label>Förtydligande (valfritt)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Svarsalternativ (ett per rad)</Label>
          <Textarea
            rows={4}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder={"Ja\nNej"}
          />
        </div>
        {error && <p className="text-sm text-lose">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            type="button"
            className="flex-1"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Avbryt
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? "Skickar…" : "Skicka förslag"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
