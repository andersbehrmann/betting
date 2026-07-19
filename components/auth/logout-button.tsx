"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/auth/actions";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => logout())}
      className={cn("rounded-lg px-2.5 py-1.5 text-sm text-muted hover:text-lose disabled:opacity-50", className)}
    >
      {pending ? "Loggar ut…" : "Logga ut"}
    </button>
  );
}
