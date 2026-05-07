import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import { LogoMark } from "@/components/logo-mark";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 text-text font-semibold text-base tracking-tight">
          <LogoMark size={20} /> AI Office
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/guide" className="text-sm text-muted hover:text-text transition-colors">
            My Guide
          </Link>
          <Link href="/dashboard" className="text-sm text-muted hover:text-text transition-colors">
            Dashboard
          </Link>
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
