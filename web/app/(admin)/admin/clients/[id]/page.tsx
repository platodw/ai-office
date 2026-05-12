import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PortalUsersPanel from "./PortalUsersPanel";
import ClientStatusSelect from "./ClientStatusSelect";
import DeployedAppsSection from "./DeployedAppsSection";
import KbArticlesPanel from "./KbArticlesPanel";
import { ticketStatusLabel } from "@/lib/support/status-labels";

export default async function AdminClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: client },
    { data: contacts },
    { data: techInfo },
    { data: apiConfigs },
    { data: services },
    { data: invoices },
    { data: tickets },
    { data: portalUsers },
    { data: apps },
    { data: kbArticles },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("client_contacts").select("*").eq("client_id", id).order("is_primary", { ascending: false }),
    supabase.from("client_tech_info").select("*").eq("client_id", id).single(),
    supabase.from("client_api_configs").select("id, provider, display_name, external_id, is_active").eq("client_id", id),
    supabase.from("client_services").select("id, name, type, amount_cents, billing_start, billing_end, status").eq("client_id", id).order("billing_start", { ascending: false }),
    supabase.from("invoices").select("id, invoice_number, status, total_cents, due_date").eq("client_id", id).order("issued_date", { ascending: false }).limit(5),
    supabase.from("support_tickets").select("id, title, status, priority, created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("client_users").select("id, user_id, portal_role, created_at, profiles(name, email)").eq("client_id", id).order("created_at"),
    supabase.from("client_apps").select("id, name, status, production_url, staging_url, repo_url, hosting, tech_stack, launched_at, supabase_project_ref").eq("client_id", id).order("created_at"),
    supabase.from("kb_articles").select("id, title, category, tags, source, is_published, created_at").eq("client_id", id).order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link href="/admin/clients" className="text-sm text-muted hover:text-text transition-colors">Clients</Link>
        <span className="text-muted">/</span>
        <span className="text-sm text-text font-medium">{client.name}</span>
      </div>

      <div className="flex items-center justify-between mt-4 mb-8">
        <div className="flex items-center gap-4">
          {client.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt={`${client.name} logo`} className="h-12 w-12 object-contain rounded-lg border border-border bg-surface p-1 shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text">{client.name}</h1>
              {client.brand_color && (
                <span className="w-4 h-4 rounded-full border border-border shrink-0" style={{ backgroundColor: client.brand_color }} title={client.brand_color} />
              )}
            </div>
            {client.website && <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-dark hover:underline">{client.website}</a>}
            {client.notes && <p className="text-sm text-muted mt-0.5">{client.notes}</p>}
          </div>
        </div>
        <ClientStatusSelect clientId={id} initial={client.status} />
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* Contacts */}
        <Section title="Contacts" action={{ label: "Add contact", href: "#" }}>
          {!contacts?.length ? (
            <Empty>No contacts added.</Empty>
          ) : (
            <ul className="space-y-3">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-text flex items-center gap-2">
                      {c.name}
                      {c.is_primary && <span className="text-[10px] bg-primary-soft text-primary-dark px-1.5 py-0.5 rounded-full font-semibold">Primary</span>}
                    </div>
                    {c.role && <div className="text-xs text-muted">{c.role}</div>}
                    {c.email && <div className="text-xs text-text-2">{c.email}</div>}
                    {c.phone && <div className="text-xs text-text-2">{c.phone}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Technical info */}
        <Section title="Technical info" action={{ label: "Edit", href: "#" }}>
          {!techInfo ? (
            <Empty>No technical info recorded.</Empty>
          ) : (
            <dl className="space-y-2">
              <TechRow label="Domain registrar" value={techInfo.domain_registrar} />
              <TechRow label="DNS provider" value={techInfo.dns_provider} />
              <TechRow label="Hosting" value={techInfo.hosting_provider} />
              <TechRow label="IT provider" value={techInfo.it_service_provider} />
              {techInfo.notes && (
                <div className="pt-2 border-t border-border mt-2">
                  <div className="text-xs text-muted mb-1">Notes</div>
                  <p className="text-xs text-text-2 leading-relaxed">{techInfo.notes}</p>
                </div>
              )}
            </dl>
          )}
        </Section>

        {/* API configurations */}
        <Section title="API configurations" action={{ label: "Add config", href: `/admin/clients/${id}/api-configs/new` }}>
          {!apiConfigs?.length ? (
            <Empty>No API configurations added.</Empty>
          ) : (
            <ul className="space-y-2">
              {apiConfigs.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <div className="text-sm font-medium text-text">{c.display_name}</div>
                    <div className="text-xs text-muted font-mono">{c.provider} / {c.external_id}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.is_active ? "bg-success/10 text-success" : "bg-surface text-muted"}`}>
                      {c.is_active ? "active" : "inactive"}
                    </span>
                    <a href={`/admin/clients/${id}/api-configs/${c.id}/edit`} className="text-xs text-muted hover:text-text transition-colors">Edit</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Services */}
        <Section title="Services" action={{ label: "Add service", href: `/admin/clients/${id}/services/new` }}>
          {!services?.length ? (
            <Empty>No services added. Add a project, retainer, or one-time fee.</Empty>
          ) : (
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.id} className="flex items-start justify-between py-1.5">
                  <div>
                    <div className="text-sm font-medium text-text">{s.name}</div>
                    <div className="text-xs text-muted">
                      {s.type === "recurring_monthly" ? "Monthly" : "One-time"} &middot; ${(s.amount_cents / 100).toFixed(2)}
                      {s.type === "recurring_monthly" && (
                        <span> &middot; {new Date(s.billing_start).toLocaleDateString("en-US", { month: "short", year: "numeric" })}{s.billing_end ? ` – ${new Date(s.billing_end).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : " (ongoing)"}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <ServiceStatusBadge status={s.status} />
                    <a href={`/admin/clients/${id}/services/${s.id}/edit`} className="text-xs text-muted hover:text-text transition-colors">Edit</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Recent invoices */}
        <Section title="Recent invoices" action={{ label: "New invoice", href: `/admin/billing/new?client=${id}` }}>
          {!invoices?.length ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-sm font-medium text-text">{inv.invoice_number}</div>
                    <div className="text-xs text-muted">Due {new Date(inv.due_date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-text">${(inv.total_cents / 100).toFixed(2)}</div>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Support tickets */}
        <Section title="Support tickets" action={{ label: "View all", href: `/admin/support?client=${id}` }}>
          {!tickets?.length ? (
            <Empty>No tickets yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-text">{t.title}</span>
                  <TicketStatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Deployed apps */}
        <div className="col-span-2 bg-surface-2 border border-border rounded-xl p-5">
          <DeployedAppsSection clientId={id} githubOrg={client.github_org ?? null} initial={apps ?? []} />
        </div>

        {/* Portal users */}
        <div className="col-span-2 bg-surface-2 border border-border rounded-xl p-5">
          <PortalUsersPanel clientId={id} initial={(portalUsers ?? []) as unknown as Parameters<typeof PortalUsersPanel>[0]["initial"]} />
        </div>

        {/* Knowledge base */}
        <div className="col-span-2 bg-surface-2 border border-border rounded-xl p-5">
          <KbArticlesPanel clientId={id} initial={kbArticles ?? []} />
        </div>

        {/* Transfer / offboarding */}
        <Section title="Account transfer">
          <p className="text-xs text-text-2 leading-relaxed mb-4">
            Generate handover instructions so the client can take ownership of their
            repositories, infrastructure, and API accounts.
          </p>
          <a
            href={`/admin/clients/${id}/transfer`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-error border border-error/30 px-3 py-1.5 rounded-lg hover:bg-error/5 transition-colors"
          >
            Begin transfer process
          </a>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: { label: string; href: string }; children: React.ReactNode }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {action && <a href={action.href} className="text-xs text-primary-dark hover:underline">{action.label}</a>}
      </div>
      {children}
    </div>
  );
}

function TechRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xs text-text text-right">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}

const INVOICE_STATUS: Record<string, string> = {
  paid: "text-success", sent: "text-primary-dark", overdue: "text-error", draft: "text-muted", void: "text-muted",
};
function InvoiceStatusBadge({ status }: { status: string }) {
  return <span className={`text-[10px] font-semibold ${INVOICE_STATUS[status] ?? "text-muted"}`}>{status}</span>;
}

const SERVICE_STATUS: Record<string, string> = {
  active: "bg-success/10 text-success", completed: "bg-surface text-muted", cancelled: "bg-error/10 text-error",
};
function ServiceStatusBadge({ status }: { status: string }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SERVICE_STATUS[status] ?? "bg-surface text-muted"}`}>{status}</span>;
}

const TICKET_STATUS: Record<string, string> = {
  open: "bg-warning/10 text-warning", ai_answered: "bg-primary-soft text-primary-dark",
  waiting_on_dan: "bg-error/10 text-error", resolved: "bg-success/10 text-success", closed: "bg-surface text-muted",
};
function TicketStatusBadge({ status }: { status: string }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TICKET_STATUS[status] ?? "bg-surface text-muted"}`}>{ticketStatusLabel(status)}</span>;
}
