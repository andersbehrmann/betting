"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { startCheckout } from "@/app/events/actions";

export function PayButton({ eventId, label }: { eventId: string; label: string }) {
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
            const res = await startCheckout(eventId);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            // Vidare till Stripe Checkout (extern domän → full navigering).
            window.location.href = res.url;
          })
        }
      >
        {pending ? "Öppnar betalning…" : label}
      </Button>
      {error && <p className="mt-2 text-sm text-lose">{error}</p>}
    </div>
  );
}
