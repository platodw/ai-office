import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/logo-mark";

const INSTALLER_URL =
  "https://github.com/platodw/ai-office/releases/latest/download/aioffice-setup.exe";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-semibold text-text text-base tracking-tight">AI Office</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-muted hover:text-text transition-colors hidden sm:inline"
            >
              Sign in
            </Link>
            <a
              href={INSTALLER_URL}
              className="bg-text hover:bg-text-2 text-bg font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Get set up
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20 grid lg:grid-cols-[1fr,1fr] gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <div>
            <div className="inline-flex items-center gap-2 bg-primary-soft border border-border rounded-full px-3 py-1.5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-xs font-medium text-primary-dark">Claude · concierge setup</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-text tracking-tight leading-[1.02]">
              Get the most out of Claude.
              <span className="block text-muted mt-1">Without the headaches.</span>
            </h1>

            <p className="text-base sm:text-lg text-text-2 mt-7 leading-relaxed max-w-lg">
              We get your Claude connected to your inbox, calendar, and notes,
              then it works the way a great chief of staff would. Quietly, in
              the background, until you need it.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <a
                href={INSTALLER_URL}
                className="inline-flex items-center justify-center gap-2 bg-text hover:bg-text-2 text-bg font-semibold px-6 py-3.5 rounded-lg text-sm transition-colors"
              >
                <Download size={16} />
                Download for Windows
                <ArrowRight size={14} className="opacity-70" />
              </a>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 bg-transparent border border-border-2 hover:border-text text-text font-semibold px-6 py-3.5 rounded-lg text-sm transition-colors"
              >
                Create an account
              </Link>
            </div>
          </div>

          {/* Right column — app preview card */}
          <AppPreview />
        </div>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// App preview card (mocked extension UI)
// ────────────────────────────────────────────────────────────────────────
function AppPreview() {
  return (
    <div className="bg-surface-2 border border-border rounded-2xl shadow-[0_20px_60px_-20px_rgba(31,26,20,0.18)] p-5 max-w-md w-full mx-auto lg:mx-0 lg:ml-auto">
      {/* App header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <LogoMark size={18} />
          <span className="text-sm font-semibold text-text">AI Office</span>
        </div>
        <span className="w-2 h-2 rounded-full bg-success" />
      </div>

      {/* Page context pill */}
      <div className="mt-4 flex items-center gap-2 bg-surface border border-border rounded-full px-3 py-1.5 w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="text-xs font-mono text-text-2">console.anthropic.com</span>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex gap-1.5">
        <ActionSquare label="📝" />
        <ActionSquare label="🔑" />
        <ActionSquare label="→" />
      </div>

      {/* Chat */}
      <div className="mt-5 space-y-3">
        <div className="flex justify-end">
          <div className="bg-primary text-bg text-sm font-medium px-3.5 py-2 rounded-2xl rounded-br-md max-w-[70%]">
            What goes here?
          </div>
        </div>
        <div className="bg-surface text-text-2 text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-md max-w-[90%] leading-relaxed">
          Click <span className="font-semibold text-text">Create Key</span>, name it &ldquo;Claude Desktop,&rdquo; then copy the value.
        </div>
      </div>
    </div>
  );
}

function ActionSquare({ label }: { label: string }) {
  return (
    <div className="w-9 h-9 bg-surface border border-border rounded-lg flex items-center justify-center text-sm">
      {label}
    </div>
  );
}
