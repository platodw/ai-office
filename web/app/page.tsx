import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/logo-mark";

const INSTALLER_URL =
  "https://github.com/platodw/ai-office/releases/latest/download/aioffice-setup.exe";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-semibold text-text">AI Office</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-muted hover:text-text transition-colors"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-text tracking-tight">
            Get real value out of Claude Desktop.
          </h1>
          <p className="text-muted text-base mt-4 leading-relaxed">
            AI Office is a guided setup and live assistant for Claude.
            It walks you through connecting your apps, then works alongside you in your browser.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={INSTALLER_URL}
              className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-text font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
            >
              <Download size={16} />
              Download for Windows
            </a>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-surface border border-border hover:border-primary text-text font-semibold px-6 py-3 rounded-lg text-sm transition-colors"
            >
              Create an account
            </Link>
          </div>

          <p className="text-muted text-xs mt-6">
            You&apos;ll need a free account to get your extension token.{" "}
            <a
              href="https://github.com/platodw/ai-office"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Source on GitHub <ExternalLink size={11} />
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
