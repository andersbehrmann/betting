"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { approveProposal, rejectProposal } from "@/app/admin/actions";
import type { ProposalRow } from "@/lib/types";

/**
 * Granskning av ett förslag. Admin kan justera allt innan godkännande –
 * godkänt förslag blir ett dolt utkast som publiceras separat.
 */
export function ProposalCard({
  proposal,
  defaultStake,
  isPoints,
}: {
  proposal: ProposalRow;
  defaultStake: number;
  isPoints: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(proposal.title);
  const [description, setDescription] = useState(proposal.description ?? "");
  const [stake, setStake] = useState(defaultStake);
  const [points, setPoints] = useState(1);
  const [optionsText, setOptionsText] = useState(
    (proposal.suggestedOptions ?? []).map((o) => o.label).join("\n"),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reviewed = proposal.status !== "pending";

  function doApprove() {
    setError(null);
    const options = optionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (options.length < 2) {
      setError("Minst 2 svarsalternativ krävs.");
      return;
    }
    startTransition(async () => {
      const res = await approveProposal(proposal.id, {
        title,
        description: description || null,
        stake: Number(stake),
        points: Number(points),
        options,
        adminNote: note || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function doReject() {
    setError(null);
    startTransition(async () => {
      const res = await rejectProposal(proposal.id, note || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-pitch">{proposal.title}</h3>
          <p className="mt-0.5 text-xs text-muted">
            Föreslaget av {proposal.proposerName ?? "okänd"}
          </p>
        </div>
        {proposal.status === "pending" ? (
          <Badge tone="gold">Väntar</Badge>
        ) : proposal.status === "approved" ? (
          <Badge tone="green">Godkänt</Badge>
        ) : (
          <Badge tone="red">Avslaget</Badge>
        )}
      </div>

      {proposal.description && <p className="mt-2 text-sm text-muted">{proposal.description}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(proposal.suggestedOptions ?? []).map((o) => (
          <span key={o.value} className="rounded-[var(--radius-pill)] bg-cream-deep px-2.5 py-1 text-xs text-ink">
            {o.label}
          </span>
        ))}
      </div>

      {proposal.adminNote && (
        <p className="mt-3 rounded-lg bg-cream-deep px-3 py-2 text-xs text-muted">
          Din kommentar: {proposal.adminNote}
        </p>
      )}

      {reviewed ? (
        proposal.status === "approved" && (
          <p className="mt-3 text-sm text-muted">
            Skapat som utkast – aktivera det under Inställningar när du vill publicera.
          </p>
        )
      ) : !editing ? (
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => setEditing(true)} disabled={isPending}>
            Granska & godkänn
          </Button>
          <Button variant="danger" onClick={doReject} disabled={isPending}>
            {isPending ? "…" : "Avslå"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 border-t border-line/60 pt-4">
          <div>
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Beskrivning</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            {isPoints ? (
              <>
                <Label>Poäng för rätt svar</Label>
                <Input type="number" min={0} step="1" value={points} onChange={(e) => setPoints(Number(e.target.value))} />
              </>
            ) : (
              <>
                <Label>Insats</Label>
                <Input type="number" min={0} step="0.5" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
              </>
            )}
          </div>
          <div>
            <Label>Svarsalternativ (ett per rad)</Label>
            <Textarea rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
          </div>
          <div>
            <Label>Kommentar till förslagsställaren (valfritt)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-sm text-lose">{error}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setEditing(false)} disabled={isPending}>
              Avbryt
            </Button>
            <Button className="flex-1" onClick={doApprove} disabled={isPending}>
              {isPending ? "Skapar utkast…" : "Godkänn som utkast"}
            </Button>
          </div>
        </div>
      )}
      {error && !editing && <p className="mt-2 text-sm text-lose">{error}</p>}
    </Card>
  );
}
