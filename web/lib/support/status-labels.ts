// Human-readable labels for support_tickets.status values. The DB enum
// uses snake_case identifiers (waiting_on_dan, ai_answered, etc.) that
// pre-date the support-team rebranding. This module is the single source
// of truth for how each status is displayed in the UI.

const LABELS: Record<string, string> = {
  open:              "Open",
  ai_answered:       "AI answered",
  awaiting_approval: "Awaiting approval",
  waiting_on_dan:    "Waiting on Support",
  resolved:          "Resolved",
  closed:            "Closed",
};

export function ticketStatusLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, " ");
}
