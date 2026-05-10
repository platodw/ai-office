import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminClients() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, status, logo_url, onboarded_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Clients</h1>
          <p className="text-sm text-muted">{clients?.length ?? 0} total</p>
        </div>
        <a
          href="/admin/clients/new"
          className="bg-text text-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-text-2 transition-colors"
        >
          Add client
        </a>
      </div>

      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        {!clients?.length ? (
          <div className="p-8 text-center text-sm text-muted">No clients yet. Add your first client to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted">Onboarded</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logo_url} alt="" className="h-7 w-7 rounded object-contain shrink-0" />
                      ) : (
                        <div className="h-7 w-7 rounded border border-border bg-surface shrink-0 flex items-center justify-center text-[10px] font-bold text-muted">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-text">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3.5 text-muted">
                    {c.onboarded_at ? new Date(c.onboarded_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/admin/clients/${c.id}`} className="text-xs text-primary-dark hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active:      "bg-success/10 text-success",
  onboarding:  "bg-primary-soft text-primary-dark",
  offboarding: "bg-warning/10 text-warning",
  churned:     "bg-surface text-muted",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-surface text-muted";
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style}`}>
      {status}
    </span>
  );
}
