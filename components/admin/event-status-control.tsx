"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEventStatusAction } from "@/app/admin/actions";

export function EventStatusControl({
  eventId,
  status,
}: {
  eventId: string;
  status: "draft" | "open" | "closed";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await setEventStatusAction(eventId, e.target.value as "draft" | "open" | "closed");
          router.refresh();
        })
      }
      className="h-9 rounded-lg border border-line bg-cream px-2 text-sm text-ink outline-none focus:border-grass disabled:opacity-50"
    >
      <option value="draft">Utkast</option>
      <option value="open">Öppet</option>
      <option value="closed">Stängt</option>
    </select>
  );
}
