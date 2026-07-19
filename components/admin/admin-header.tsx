"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/app/admin/actions";

const TABS = [
  { href: "/admin", label: "Översikt" },
  { href: "/admin/events", label: "Event" },
  { href: "/admin/settings", label: "Inställningar" },
  { href: "/admin/results", label: "Resultat" },
];

export function AdminHeader() {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-cream/90 backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex h-14 items-center justify-between">
          <span className="flex items-center gap-2 font-display font-bold text-pitch">
            <span aria-hidden>⚙️</span> Admin
          </span>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-muted hover:text-pitch">
              Se deltagarvy
            </Link>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => adminLogout())}
              className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:text-lose"
            >
              Logga ut
            </button>
          </div>
        </div>
        <nav className="flex gap-1 pb-2">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-pitch text-chalk" : "text-muted hover:bg-cream-deep",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
