import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

// Smart admin-grind: inte inloggad → /login. Inloggad utan admin → nekad (ingen loop).
export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.isAdmin) redirect("/admin");
  if (!user) redirect("/login?next=/admin");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <Card className="p-6 text-center">
        <p className="font-display text-lg text-pitch">Ingen behörighet</p>
        <p className="mt-1 text-sm text-muted">Ditt konto har inte adminbehörighet.</p>
        <Link href="/" className="mt-3 inline-block font-medium text-grass hover:underline">
          Till startsidan →
        </Link>
      </Card>
    </main>
  );
}
