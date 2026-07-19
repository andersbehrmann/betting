"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { createEventAction } from "@/app/admin/actions";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // ta bort diakritiska tecken
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [eventType, setEventType] = useState<"betting" | "points">("betting");
  const [joinFeeKr, setJoinFeeKr] = useState("0");
  const [currency, setCurrency] = useState("SEK");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "open" | "closed">("draft");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveSlug = slugEdited ? slug : slugify(name);

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-pitch">Skapa nytt event</h2>
      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="ev-name">Namn</Label>
          <Input
            id="ev-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Crossfit Games 2026"
          />
        </div>
        <div>
          <Label htmlFor="ev-slug">Slug (i URL:en)</Label>
          <Input
            id="ev-slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="crossfit-games-2026"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ev-type">Typ</Label>
            <select
              id="ev-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as "betting" | "points")}
              className="h-12 w-full rounded-xl border border-line bg-cream px-3 text-base text-ink outline-none focus:border-grass focus:bg-chalk"
            >
              <option value="betting">Betting</option>
              <option value="points">Poäng</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ev-status">Status</Label>
            <select
              id="ev-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "open" | "closed")}
              className="h-12 w-full rounded-xl border border-line bg-cream px-3 text-base text-ink outline-none focus:border-grass focus:bg-chalk"
            >
              <option value="draft">Utkast (dolt)</option>
              <option value="open">Öppet</option>
              <option value="closed">Stängt</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ev-fee">Anslutningsavgift (kr)</Label>
            <Input
              id="ev-fee"
              type="number"
              min={0}
              value={joinFeeKr}
              onChange={(e) => setJoinFeeKr(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ev-cur">Valuta</Label>
            <Input id="ev-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="ev-desc">Beskrivning (valfritt)</Label>
          <Input
            id="ev-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kort beskrivning som visas publikt."
          />
        </div>

        {error && <p className="text-sm text-lose">{error}</p>}

        <Button
          size="lg"
          disabled={pending || !name.trim() || !effectiveSlug}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await createEventAction({
                name: name.trim(),
                slug: effectiveSlug,
                eventType,
                joinFeeKr: Number(joinFeeKr) || 0,
                currency: currency.trim() || "SEK",
                description: description.trim() || null,
                status,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              router.refresh();
              setName("");
              setSlug("");
              setSlugEdited(false);
              setDescription("");
            })
          }
        >
          {pending ? "Skapar…" : "Skapa event"}
        </Button>
      </div>
    </Card>
  );
}
