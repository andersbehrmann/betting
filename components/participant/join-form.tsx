"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { joinEvent } from "@/app/actions";

export function JoinForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await joinEvent(eventId, name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-pitch">Häng med i tipsleken</h2>
      <p className="mt-1 text-sm text-muted">
        Skriv ditt namn så kommer du till dina spel. Namnet syns för de andra när resultaten
        offentliggörs.
      </p>
      <form onSubmit={onSubmit} className="mt-4">
        <Label htmlFor="name">Ditt namn</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="t.ex. Anna"
          autoComplete="off"
          maxLength={40}
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-lose">{error}</p>}
        <Button size="lg" className="mt-4" type="submit" disabled={isPending || name.trim().length < 2}>
          {isPending ? "Ett ögonblick…" : "Kom igång →"}
        </Button>
      </form>
    </Card>
  );
}
