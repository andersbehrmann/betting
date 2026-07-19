"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Card, Input, Label } from "@/components/ui";
import {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  type AuthState,
} from "@/app/auth/actions";

function ErrorText({ state }: { state: AuthState }) {
  if (!state?.error) return null;
  return <p className="mt-3 text-sm text-lose">{state.error}</p>;
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, undefined);
  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold text-pitch">Skapa konto</h1>
      <p className="mt-1 text-sm text-muted">Gratis – du behöver bara namn, användarnamn och e-post.</p>
      <form action={action} className="mt-5 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <Label htmlFor="name">Namn</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div>
          <Label htmlFor="username">Användarnamn</Label>
          <Input id="username" name="username" autoComplete="username" required />
        </div>
        <div>
          <Label htmlFor="email">E-post</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Lösenord</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
          <p className="mt-1 text-xs text-muted">Minst 8 tecken.</p>
        </div>
        <ErrorText state={state} />
        <Button size="lg" type="submit" disabled={pending}>
          {pending ? "Skapar konto…" : "Skapa konto"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Har du redan ett konto?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-grass hover:underline">
          Logga in
        </Link>
      </p>
    </Card>
  );
}

export function LoginForm({ next, reset }: { next?: string; reset?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined);
  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold text-pitch">Logga in</h1>
      {reset && (
        <p className="mt-2 rounded-lg bg-grass/12 px-3 py-2 text-sm text-grass">
          Lösenordet är uppdaterat. Logga in med ditt nya lösenord.
        </p>
      )}
      <form action={action} className="mt-5 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <Label htmlFor="email">E-post</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        <div>
          <Label htmlFor="password">Lösenord</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <ErrorText state={state} />
        <Button size="lg" type="submit" disabled={pending}>
          {pending ? "Loggar in…" : "Logga in"}
        </Button>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-pitch">
          Glömt lösenord?
        </Link>
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-grass hover:underline">
          Skapa konto
        </Link>
      </div>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, undefined);
  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold text-pitch">Glömt lösenord</h1>
      {state?.ok ? (
        <p className="mt-3 text-sm text-ink">
          Om adressen finns hos oss har vi skickat en återställningslänk. Kolla din inkorg.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Ange din e-post så skickar vi en återställningslänk.</p>
          <form action={action} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="email">E-post</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
            </div>
            <ErrorText state={state} />
            <Button size="lg" type="submit" disabled={pending}>
              {pending ? "Skickar…" : "Skicka länk"}
            </Button>
          </form>
        </>
      )}
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-grass hover:underline">
          Tillbaka till inloggning
        </Link>
      </p>
    </Card>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPassword, undefined);
  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold text-pitch">Nytt lösenord</h1>
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <Label htmlFor="password">Nytt lösenord</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
          <p className="mt-1 text-xs text-muted">Minst 8 tecken.</p>
        </div>
        <ErrorText state={state} />
        <Button size="lg" type="submit" disabled={pending}>
          {pending ? "Sparar…" : "Spara nytt lösenord"}
        </Button>
      </form>
    </Card>
  );
}
