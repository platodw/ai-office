import { createClient } from "@supabase/supabase-js";

interface ServiceDef {
  id: string;
  name: string;
  type: string;
  description: string;
  clients: string[];
  sessionClient?: string;
  sessionService?: string;
  docsUrl: string;
}

const SERVICES: ServiceDef[] = [
  {
    id: "buildertrend-swc",
    name: "BuilderTrend",
    type: "Session-kept proxy",
    description:
      "Proxies BuilderTrend internal API calls using a headless-browser session refreshed every 3 hours via GitHub Actions. Provides jobs, schedules, change orders, leads, and contacts to the SWC dashboard.",
    clients: ["Southwest Companies"],
    sessionClient: "southwest-companies",
    sessionService: "buildertrend",
    docsUrl: "https://github.com/platodw/dpc-ai-office-infra",
  },
];

type SessionRow = {
  client: string;
  service: string;
  refreshed_at: string | null;
  is_valid: boolean | null;
  failure_count: number | null;
};

type HealthStatus = "healthy" | "stale" | "down" | "unknown";

function computeHealth(row: SessionRow | undefined): { status: HealthStatus; refreshedAt: string | null } {
  if (!row || !row.refreshed_at) return { status: "unknown", refreshedAt: null };
  if (!row.is_valid || (row.failure_count ?? 0) > 0) return { status: "down", refreshedAt: row.refreshed_at };
  const ageMs = Date.now() - new Date(row.refreshed_at).getTime();
  const ageHours = ageMs / 1000 / 60 / 60;
  let status: HealthStatus;
  if (ageHours < 4) status = "healthy";
  else if (ageHours < 8) status = "stale";
  else status = "down";
  return { status, refreshedAt: row.refreshed_at };
}

async function fetchSessions(): Promise<SessionRow[]> {
  const url = process.env.INFRA_SUPABASE_URL;
  const key = process.env.INFRA_SUPABASE_SERVICE_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data } = await sb
      .from("sessions")
      .select("client, service, refreshed_at, is_valid, failure_count");
    return (data as SessionRow[]) ?? [];
  } catch {
    return [];
  }
}

export const metadata = { title: "Infrastructure — AI Office Admin" };

export default async function InfrastructurePage() {
  const sessions = await fetchSessions();
  const infraEnvMissing = !process.env.INFRA_SUPABASE_URL || !process.env.INFRA_SUPABASE_SERVICE_KEY;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Infrastructure</h1>
      <p className="text-sm text-muted mb-8">MCP proxies and shared services powering AI Office clients</p>

      {infraEnvMissing && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
          <span className="font-semibold">Health data unavailable</span> — add{" "}
          <code className="font-mono text-xs">INFRA_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-xs">INFRA_SUPABASE_SERVICE_KEY</code> to Vercel env vars.
        </div>
      )}

      <div className="space-y-4">
        {SERVICES.map((svc) => {
          const sessionRow = sessions.find(
            (s) => s.client === svc.sessionClient && s.service === svc.sessionService
          );
          const { status, refreshedAt } = computeHealth(sessionRow);
          return (
            <div key={svc.id} className="bg-surface-2 border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-text">{svc.name}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface text-muted border border-border">
                      {svc.type}
                    </span>
                  </div>
                  <p className="text-sm text-muted leading-relaxed mb-3">{svc.description}</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                    <span>
                      <span className="font-medium text-text-2">Clients:</span>{" "}
                      {svc.clients.join(", ")}
                    </span>
                    <a
                      href={svc.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-dark hover:underline"
                    >
                      Docs ↗
                    </a>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <HealthBadge status={status} />
                  {refreshedAt && (
                    <div className="text-[10px] text-muted mt-1">
                      Refreshed {formatAge(refreshedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const HEALTH_STYLES: Record<HealthStatus, string> = {
  healthy: "bg-success/10 text-success",
  stale:   "bg-warning/10 text-warning",
  down:    "bg-error/10 text-error",
  unknown: "bg-surface text-muted",
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: "Healthy",
  stale:   "Stale",
  down:    "Down",
  unknown: "Unknown",
};

function HealthBadge({ status }: { status: HealthStatus }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${HEALTH_STYLES[status]}`}>
      {HEALTH_LABELS[status]}
    </span>
  );
}

function formatAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
