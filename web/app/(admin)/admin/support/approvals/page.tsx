import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ApprovalRow from "./ApprovalRow";

export default async function ApprovalsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: approvals } = await supabase
    .from("support_approvals")
    .select("id, kind, tool_name, title, description, payload, status, created_at, clients(name), support_tickets!conversation_id(id, title)")
    .order("created_at", { ascending: false })
    .limit(100);

  type Row = NonNullable<typeof approvals>[number];
  const pending = (approvals ?? []).filter((a: Row) => a.status === "pending");
  const recent  = (approvals ?? []).filter((a: Row) => a.status !== "pending");

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Approvals</h1>
      <p className="text-sm text-muted mb-6">
        Actions the support agent proposed that need your approval before they run.
      </p>

      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-2 mb-3">Pending</h2>
        {!pending.length ? (
          <div className="bg-surface-2 border border-border rounded-xl p-6 text-sm text-muted text-center">
            Nothing waiting on you.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((a: Row) => <ApprovalRow key={a.id} approval={a as unknown as Parameters<typeof ApprovalRow>[0]["approval"]} />)}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-2 mb-3">Recent decisions</h2>
          <div className="bg-surface-2 border border-border rounded-xl divide-y divide-border overflow-hidden">
            {recent.slice(0, 20).map((a: Row) => {
              const clientName = (a.clients as unknown as { name: string } | null)?.name ?? "—";
              return (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-text">{a.title}</div>
                    <div className="text-xs text-muted">{clientName} · {a.tool_name}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    a.status === "executed"  ? "bg-success/10 text-success" :
                    a.status === "approved"  ? "bg-primary-soft text-primary-dark" :
                    a.status === "rejected"  ? "bg-surface text-muted" :
                                               "bg-error/10 text-error"
                  }`}>
                    {a.status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
