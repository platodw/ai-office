import { requireClientUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ChatPanel from "./ChatPanel";

export default async function PortalChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { clientId } = await requireClientUser();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("support_tickets")
    .select("id, title, status, updated_at, created_at")
    .eq("client_id", clientId)
    .eq("kind", "chat")
    .order("updated_at", { ascending: false })
    .limit(30);

  const activeId = sp.c ?? conversations?.[0]?.id ?? null;

  let initialMessages: { id: string; author_type: string; content: string; created_at: string }[] = [];
  if (activeId) {
    const { data: msgs } = await supabase
      .from("support_messages")
      .select("id, author_type, content, created_at")
      .eq("ticket_id", activeId)
      .in("author_type", ["client", "ai"])
      .order("created_at", { ascending: true });
    initialMessages = msgs ?? [];
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text mb-1">Chat</h1>
      <p className="text-sm text-muted mb-6">
        Ask anything about your setup or your apps. Your AI Office agent searches the knowledge base before answering.
      </p>

      <div className="grid grid-cols-[240px_1fr] gap-6 min-h-[500px]">
        <aside className="border border-border rounded-xl bg-surface-2 p-3 overflow-hidden">
          <a
            href="/portal/chat"
            className="block text-xs font-semibold bg-text text-bg text-center py-2 rounded-lg hover:bg-text-2 transition-colors mb-3"
          >
            New chat
          </a>
          <div className="space-y-1">
            {(conversations ?? []).map((c) => {
              const isActive = c.id === activeId;
              return (
                <a
                  key={c.id}
                  href={`/portal/chat?c=${c.id}`}
                  className={`block px-2.5 py-2 rounded-lg text-xs transition-colors ${
                    isActive ? "bg-primary-soft text-primary-dark" : "text-text hover:bg-surface"
                  }`}
                >
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-[10px] text-muted mt-0.5">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </div>
                </a>
              );
            })}
            {!conversations?.length && (
              <p className="text-xs text-muted px-2 py-1">No conversations yet.</p>
            )}
          </div>
        </aside>

        <ChatPanel
          conversationId={activeId}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
}
