"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { createFriendGroup, joinFriendGroup } from "@/app/events/friends-actions";

export function CreateFriendGroupForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-pitch">Skapa en kompisliga</h2>
      <p className="mt-1 text-sm text-muted">
        En privat ställning bara för dig och de du bjuder in.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await createFriendGroup(eventId, name);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setName("");
            router.refresh();
          });
        }}
      >
        <div>
          <Label htmlFor="lb-name">Namn</Label>
          <Input
            id="lb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="t.ex. Jobbgänget"
            required
          />
        </div>
        {error && <p className="text-sm text-lose">{error}</p>}
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Skapar…" : "Skapa liga"}
        </Button>
      </form>
    </Card>
  );
}

export function JoinFriendGroupForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold text-pitch">Gå med i en liga</h2>
      <p className="mt-1 text-sm text-muted">Har du fått en kod av en kompis?</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await joinFriendGroup(code);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setCode("");
            router.refresh();
          });
        }}
      >
        <div>
          <Label htmlFor="lb-code">Inbjudningskod</Label>
          <Input
            id="lb-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD2345"
            className="font-mono tracking-widest"
            required
          />
        </div>
        {error && <p className="text-sm text-lose">{error}</p>}
        <Button variant="outline" type="submit" disabled={pending || !code.trim()}>
          {pending ? "Går med…" : "Gå med"}
        </Button>
      </form>
    </Card>
  );
}

/** Kopierbar inbjudningskod/länk för ligans medlemmar. */
export function InviteCode({ code, url }: { code: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-xl bg-cream-deep px-3 py-2">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
        Inbjudningskod
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="font-mono text-lg tracking-widest text-ink">{code}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-grass hover:bg-grass/10"
        >
          {copied ? "Kopierad!" : "Kopiera länk"}
        </button>
      </div>
    </div>
  );
}
