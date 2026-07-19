"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { adminLogin } from "@/app/admin/actions";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await adminLogin(password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold text-pitch">Admin</h1>
      <p className="mt-1 text-sm text-muted">Ange adminlösenordet för att fortsätta.</p>
      <form onSubmit={onSubmit} className="mt-4">
        <Label htmlFor="pw">Lösenord</Label>
        <Input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-lose">{error}</p>}
        <Button size="lg" className="mt-4" type="submit" disabled={isPending || !password}>
          {isPending ? "Loggar in…" : "Logga in"}
        </Button>
      </form>
    </Card>
  );
}
