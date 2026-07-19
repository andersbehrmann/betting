import { isAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/admin-header";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  return (
    <>
      {admin && <AdminHeader />}
      <div className="mx-auto max-w-3xl px-4 py-4">{children}</div>
    </>
  );
}
