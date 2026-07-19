"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { saveEventSettings, type SettingsInputRaw } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export interface SettingsFormValues {
  name: string;
  teamOne: string;
  teamTwo: string;
  matchStart: string; // datetime-local
  bettingDeadline: string; // datetime-local
  currency: string;
  defaultStake: number;
  jackpotStake: number;
  starPlayerName: string;
  starListenTarget: string;
  countStaffCards: boolean;
  closestResultMode: "nearest" | "no_winner";
  packageTiebreakExact: boolean;
}

export function SettingsForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: SettingsFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<SettingsFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof SettingsFormValues>(key: K, val: SettingsFormValues[K]) {
    setSaved(false);
    setV((prev) => ({ ...prev, [key]: val }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const raw: SettingsInputRaw = {
      ...v,
      defaultStake: Number(v.defaultStake),
      jackpotStake: Number(v.jackpotStake),
      starPlayerName: v.starPlayerName || null,
      starListenTarget: v.starListenTarget || null,
    };
    startTransition(async () => {
      const res = await saveEventSettings(eventId, raw);
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
      <h2 className="font-display text-lg font-bold text-pitch">Matchinställningar</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field label="Eventnamn">
          <Input value={v.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Lag 1">
            <Input value={v.teamOne} onChange={(e) => set("teamOne", e.target.value)} required />
          </Field>
          <Field label="Lag 2">
            <Input value={v.teamTwo} onChange={(e) => set("teamTwo", e.target.value)} required />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Avspark (matchstart)">
            <Input type="datetime-local" value={v.matchStart} onChange={(e) => set("matchStart", e.target.value)} required />
          </Field>
          <Field label="Tipsstopp (deadline)">
            <Input type="datetime-local" value={v.bettingDeadline} onChange={(e) => set("bettingDeadline", e.target.value)} required />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">Tider tolkas i svensk tid (Europe/Stockholm).</p>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Valuta">
            <Input value={v.currency} onChange={(e) => set("currency", e.target.value)} />
          </Field>
          <Field label="Insats/spel">
            <Input type="number" min={0} step="0.5" value={v.defaultStake} onChange={(e) => set("defaultStake", Number(e.target.value))} />
          </Field>
          <Field label="Jackpotinsats">
            <Input type="number" min={0} step="0.5" value={v.jackpotStake} onChange={(e) => set("jackpotStake", Number(e.target.value))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stjärnspelare (spel 12)">
            <Input value={v.starPlayerName} onChange={(e) => set("starPlayerName", e.target.value)} placeholder="Namn att lyssna efter" />
          </Field>
          <Field label="Kommentator lyssnar efter">
            <Input value={v.starListenTarget} onChange={(e) => set("starListenTarget", e.target.value)} placeholder="Person/namn" />
          </Field>
        </div>

        <Field label="Om ingen har exakt rätt resultat (spel 2)">
          <Select
            value={v.closestResultMode}
            onChange={(val) => set("closestResultMode", val as "nearest" | "no_winner")}
            options={[
              { value: "no_winner", label: "Ingen vinnare – potten lämnas" },
              { value: "nearest", label: "Närmast resultat vinner" },
            ]}
          />
        </Field>

        <Check
          label="Räkna kort till ledare/avbytare (spel 8)"
          hint="Standard av: bara spelare på planen/i truppen räknas."
          checked={v.countStaffCards}
          onChange={(c) => set("countStaffCards", c)}
        />
        <Check
          label="Använd exakt resultat som utslagsfråga i matchpaketet"
          hint="Vid lika poäng vinner den vars resultatgissning ligger närmast."
          checked={v.packageTiebreakExact}
          onChange={(c) => set("packageTiebreakExact", c)}
        />

        {error && <p className="text-sm text-lose">{error}</p>}
        {saved && <p className="text-sm text-grass">✓ Sparat.</p>}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Sparar…" : "Spara inställningar"}
        </Button>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-line bg-cream px-3 text-base text-ink outline-none focus:border-grass focus:bg-chalk"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl border border-line bg-cream px-3 py-2.5 text-left"
    >
      <span
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2 text-xs",
          checked ? "border-grass bg-grass text-chalk" : "border-line",
        )}
      >
        {checked && "✓"}
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}
