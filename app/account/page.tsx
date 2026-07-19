import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { LogoutButton } from "@/components/auth/logout-button";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-pitch">
          ← Till startsidan
        </Link>
        <LogoutButton />
      </div>

      <Card className="p-6">
        <h1 className="font-display text-xl font-bold text-pitch">Mitt konto</h1>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between border-b border-line/60 pb-2">
            <dt className="text-muted">Namn</dt>
            <dd className="font-medium text-ink">{user.name}</dd>
          </div>
          <div className="flex justify-between border-b border-line/60 pb-2">
            <dt className="text-muted">Användarnamn</dt>
            <dd className="font-medium text-ink">{user.username}</dd>
          </div>
          <div className="flex justify-between border-b border-line/60 pb-2">
            <dt className="text-muted">E-post</dt>
            <dd className="font-medium text-ink">{user.email}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-2">
          <Link href="/forgot-password" className="text-sm text-grass hover:underline">
            Byt lösenord
          </Link>
          {user.isAdmin && (
            <Link href="/admin" className="text-sm font-medium text-grass hover:underline">
              Till admin →
            </Link>
          )}
        </div>
      </Card>
    </main>
  );
}
