import { requireClientUser } from "@/lib/auth";
import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import LogoutButton from "@/components/logout-button";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireClientUser();

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <Link href="/portal" className="flex items-center gap-2 text-text font-semibold text-base tracking-tight">
          <LogoMark size={20} /> AI Office
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/portal" className="text-sm text-muted hover:text-text transition-colors">Home</Link>
          <Link href="/portal/chat" className="text-sm text-muted hover:text-text transition-colors">Chat</Link>
          <Link href="/portal/billing" className="text-sm text-muted hover:text-text transition-colors">Billing</Link>
          <Link href="/portal/support" className="text-sm text-muted hover:text-text transition-colors">Support</Link>
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
