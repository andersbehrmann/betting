import Link from "next/link";
import { Card } from "@/components/ui";
import { ResetPasswordForm } from "@/components/auth/forms";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Card className="p-6 text-center">
          <p className="font-display text-lg text-pitch">Ogiltig länk</p>
          <p className="mt-1 text-sm text-muted">Länken saknar en giltig token.</p>
          <Link href="/forgot-password" className="mt-3 inline-block font-medium text-grass hover:underline">
            Begär en ny återställningslänk →
          </Link>
        </Card>
      )}
    </main>
  );
}
