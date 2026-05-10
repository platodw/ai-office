"use client";
import { useState } from "react";
import ImportAppsButton from "./apps/ImportAppsButton";

type App = {
  id: string;
  name: string;
  status: string;
  production_url: string | null;
  staging_url: string | null;
  repo_url: string | null;
  hosting: string | null;
  tech_stack: string | null;
  launched_at: string | null;
};

const APP_STATUS: Record<string, string> = {
  active:      "bg-success/10 text-success",
  planning:    "bg-primary-soft text-primary-dark",
  maintenance: "bg-warning/10 text-warning",
  deprecated:  "bg-surface text-muted",
};

export default function DeployedAppsSection({
  clientId,
  githubOrg,
  initial,
}: {
  clientId: string;
  githubOrg: string | null;
  initial: App[];
}) {
  const [apps, setApps] = useState(initial);

  async function refresh() {
    const res = await fetch(`/api/admin/clients/${clientId}/apps`);
    if (res.ok) setApps(await res.json());
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-text">Deployed apps</h2>
          <p className="text-xs text-muted mt-0.5">Projects and applications built for this client</p>
        </div>
        <div className="flex gap-2">
          <ImportAppsButton clientId={clientId} initialGithubOrg={githubOrg} onImported={refresh} />
          <a href={`/admin/clients/${clientId}/apps/new`} className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors">
            Add app
          </a>
        </div>
      </div>

      {!apps.length ? (
        <p className="text-sm text-muted">
          No apps yet.{" "}
          <a href={`/admin/clients/${clientId}/apps/new`} className="text-primary-dark hover:underline">Add one manually</a>
          {" "}or use "Import from GitHub" above.
        </p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Name</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Stack</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Hosting</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted font-medium">Links</th>
                <th className="text-right px-4 py-2.5 text-xs text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text">{app.name}</div>
                    {app.launched_at && (
                      <div className="text-xs text-muted">
                        Launched {new Date(app.launched_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{app.tech_stack ?? "—"}</td>
                  <td className="px-4 py-3 text-muted text-xs">{app.hosting ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      {app.production_url && <a href={app.production_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-dark hover:underline">Production</a>}
                      {app.staging_url    && <a href={app.staging_url}    target="_blank" rel="noopener noreferrer" className="text-xs text-muted hover:text-text">Staging</a>}
                      {app.repo_url       && <a href={app.repo_url}       target="_blank" rel="noopener noreferrer" className="text-xs text-muted hover:text-text">Repo</a>}
                      {!app.production_url && !app.staging_url && !app.repo_url && <span className="text-xs text-muted">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${APP_STATUS[app.status] ?? "bg-surface text-muted"}`}>
                      {app.status}
                    </span>
                    <a href={`/admin/clients/${clientId}/apps/${app.id}/edit`} className="text-xs text-muted hover:text-text ml-3">Edit</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
