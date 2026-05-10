import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import MyAccountForm from "./MyAccountForm";
import AdminUsersPanel from "./AdminUsersPanel";

export default async function AdminSettingsPage() {
  const currentUser = await requireAdmin();
  const supabase = await createClient();

  const { data: admins } = await supabase
    .from("profiles")
    .select("id, name, email, created_at")
    .eq("is_admin", true)
    .order("created_at");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-text mb-1">Settings</h1>
      <p className="text-sm text-muted mb-10">Manage your account and admin users</p>

      <section className="mb-12">
        <h2 className="text-base font-semibold text-text mb-4">My account</h2>
        <div className="bg-surface-2 border border-border rounded-xl p-6">
          <MyAccountForm userId={currentUser.id} initialEmail={currentUser.email ?? ""} />
        </div>
      </section>

      <section>
        <div className="bg-surface-2 border border-border rounded-xl p-6">
          <AdminUsersPanel initial={admins ?? []} />
        </div>
      </section>
    </div>
  );
}
