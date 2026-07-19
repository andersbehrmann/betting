import { ForgotPasswordForm } from "@/components/auth/forms";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <ForgotPasswordForm />
    </main>
  );
}
