import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SuggestionList from "./suggestion-list";

export default async function AdminSuggestionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/dashboard");

  const { data: suggestions } = await supabase
    .from("template_suggestions")
    .select("*")
    .order("created_at", { ascending: false });

  const { count: telemetryCount } = await supabase
    .from("chat_telemetry")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/dashboard" className="text-xs text-muted hover:text-text">← Dashboard</Link>
        <h1 className="text-2xl font-semibold text-text tracking-tight mt-2">Instruction suggestions</h1>
        <p className="text-muted text-sm mt-1">
          {telemetryCount ?? 0} chat events in the last 7 days. Click Generate to ask Claude to scan them for instruction improvements.
        </p>
      </div>

      <SuggestionList initial={suggestions || []} />
    </div>
  );
}
