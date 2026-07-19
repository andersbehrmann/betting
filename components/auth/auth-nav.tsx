import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

// Auth-medveten nav-del. Server-komponent – återanvänds i sidhuvuden.
export async function AuthNav() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <Link href="/account" className="rounded-lg px-2.5 py-1.5 text-muted hover:text-pitch">
        {user.isAdmin ? "Konto ⚙️" : "Konto"}
      </Link>
    );
  }
  return (
    <>
      <Link href="/login" className="rounded-lg px-2.5 py-1.5 text-muted hover:text-pitch">
        Logga in
      </Link>
      <Link
        href="/register"
        className="rounded-[var(--radius-pill)] bg-grass px-3 py-1.5 font-medium text-chalk hover:bg-grass-bright"
      >
        Skapa konto
      </Link>
    </>
  );
}
