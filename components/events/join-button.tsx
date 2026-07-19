"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { joinPlatformEvent } from "@/app/events/actions";

export function JoinButton({ eventId, label }: { eventId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await joinPlatformEvent(eventId);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Ansluter…" : label}
      </Button>
      {error && <p className="mt-2 text-sm text-lose">{error}</p>}
    </div>
  );
}
