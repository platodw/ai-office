import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import LogoutButton from "@/components/logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center gap-2">
          <LogoMark size={20} />
          <div>
            <div className="text-sm font-semibold text-text leading-tight">AI Office</div>
            <div className="text-[10px] text-muted">Admin</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <NavLink href="/admin">Overview</NavLink>
          <NavLink href="/admin/clients">Clients</NavLink>
          <NavLink href="/admin/billing">Billing</NavLink>
          <NavLink href="/admin/support">Support</NavLink>
        </nav>
        <div className="px-4 py-3 border-t border-border">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-lg text-sm text-text-2 hover:bg-surface hover:text-text transition-colors"
    >
      {children}
    </Link>
  );
}
