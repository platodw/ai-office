import Link from "next/link";
import { ArrowRight, CheckCircle, Mail, GitBranch, FileText, Search, BookOpen, MessageSquare } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Header />
      <main className="flex-1">
        <Hero />
        <WhatWeBuilt />
        <HowItWorks />
        <About />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="font-semibold text-text text-base tracking-tight">AI Office</span>
        </div>
        <nav className="hidden md:flex items-center gap-7">
          <Link href="#services" className="text-sm text-muted hover:text-text transition-colors">Services</Link>
          <Link href="#how-it-works" className="text-sm text-muted hover:text-text transition-colors">How it works</Link>
          <Link href="#about" className="text-sm text-muted hover:text-text transition-colors">About</Link>
          <Link href="#pricing" className="text-sm text-muted hover:text-text transition-colors">Pricing</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/portal" className="text-sm text-muted hover:text-text transition-colors hidden sm:block">
            Client portal
          </Link>
          <a
            href="mailto:dan@danplato.com?subject=AI Office inquiry"
            className="bg-text hover:bg-text-2 text-bg font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Let&apos;s talk
          </a>
        </div>
      </div>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 bg-primary-soft border border-border rounded-full px-3 py-1.5 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-xs font-medium text-primary-dark">AI-enabled tools, built for your business</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-text tracking-tight leading-[1.02]">
          AI that actually works
          <span className="block text-muted mt-1">for your business.</span>
        </h1>

        <p className="text-base sm:text-lg text-text-2 mt-7 leading-relaxed max-w-2xl">
          Most small businesses know AI can help them move faster and do more with less. The hard
          part is figuring out what to build, getting it running, and keeping it working. That&apos;s
          exactly what AI Office does.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3">
          <a
            href="mailto:dan@danplato.com?subject=AI Office inquiry"
            className="inline-flex items-center justify-center gap-2 bg-text hover:bg-text-2 text-bg font-semibold px-6 py-3.5 rounded-lg text-sm transition-colors"
          >
            Start a conversation
            <ArrowRight size={14} className="opacity-70" />
          </a>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 bg-transparent border border-border-2 hover:border-text text-text font-semibold px-6 py-3.5 rounded-lg text-sm transition-colors"
          >
            See how it works
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── What we build ─────────────────────────────────────────────────────────────

function WhatWeBuilt() {
  const examples = [
    {
      Icon: Mail,
      title: "Email & communication",
      desc: "Draft responses, triage inboxes, summarize threads, and route customer inquiries automatically.",
    },
    {
      Icon: GitBranch,
      title: "Ops & workflow automation",
      desc: "Turn recurring tasks into automated flows: status updates, reporting, scheduling, follow-ups.",
    },
    {
      Icon: FileText,
      title: "Document generation",
      desc: "Proposals, SOWs, reports, and templates built from your data and formatted your way.",
    },
    {
      Icon: Search,
      title: "Research & analysis",
      desc: "Competitive intel, market research, and data summaries on demand, without the manual work.",
    },
    {
      Icon: BookOpen,
      title: "Knowledge & memory",
      desc: "Give your business a memory. AI that knows your clients, your products, and your decisions.",
    },
    {
      Icon: MessageSquare,
      title: "Client-facing tools",
      desc: "Chatbots, intake flows, and self-service tools that reflect your brand and your process.",
    },
  ];

  return (
    <section id="services" className="border-t border-border bg-surface/40 py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text tracking-tight">
            Custom AI tools for your specific workflows
          </h2>
          <p className="text-text-2 mt-4 leading-relaxed">
            We don&apos;t sell you a generic AI subscription. We learn how your business works and build
            tools that fit the way you actually operate. Every client gets a different set of apps
            because every business has different problems worth solving.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {examples.map((item) => (
            <div key={item.title} className="bg-surface-2 border border-border rounded-xl p-5">
              <div className="mb-3 text-muted"><item.Icon size={18} strokeWidth={1.5} /></div>
              <h3 className="font-semibold text-text text-sm mb-1.5">{item.title}</h3>
              <p className="text-text-2 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Discovery",
      desc: "We start with a structured conversation about your business: what tools you use, how your team works, and where time is being wasted. No assumptions, no templates, just listening.",
    },
    {
      number: "02",
      title: "Scoping",
      desc: "We map your use cases to specific AI apps and agree on a Phase 1 build plan. You know exactly what will be built, what it will cost, and what it will do before we write a line of code.",
    },
    {
      number: "03",
      title: "Build",
      desc: "We build and deploy your custom AI tools on your infrastructure. You own what gets built. We handle the technical work: the AI layer, the integrations, the hosting.",
    },
    {
      number: "04",
      title: "Run",
      desc: "Once live, we manage everything: the AI infrastructure costs, bug fixes, and ongoing enhancements. Your tools stay working and improving without you thinking about it.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text tracking-tight">
            From zero to a working AI setup
          </h2>
          <p className="text-text-2 mt-4 leading-relaxed">
            Most businesses stall at &ldquo;we should be using AI more.&rdquo; AI Office moves you from that
            conversation to tools that are running, useful, and maintained.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {steps.map((step) => (
            <div key={step.number} className="bg-surface/40 border border-border rounded-xl p-6">
              <div className="text-3xl font-bold text-border mb-4 font-mono">{step.number}</div>
              <h3 className="font-semibold text-text mb-2">{step.title}</h3>
              <p className="text-text-2 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── About ─────────────────────────────────────────────────────────────────────

function About() {
  return (
    <section id="about" className="py-20 sm:py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-[1fr,380px] gap-12 items-start">

          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-primary-soft border border-border rounded-full px-3 py-1.5 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-xs font-medium text-primary-dark">Who&apos;s behind AI Office</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-text tracking-tight mb-6">
              Business-first. AI-powered.
            </h2>

            <div className="space-y-4 text-text-2 leading-relaxed">
              <p>
                I&apos;m Dan Plato, a management consultant with over 20 years of experience helping
                organizations understand their operations, improve their processes, and make better
                decisions. AI Office is built on that foundation.
              </p>
              <p>
                Most AI development shops start with the technology and work backward to the problem.
                I start with the business. Before a single line of code gets written, I spend time
                understanding your workflows, your pain points, and what a good outcome actually
                looks like for your team. That background in business analysis and process design is
                what makes the difference between an AI tool that gets used and one that sits idle.
              </p>
              <p>
                For the build itself, I work with a team of Claude-based AI agents that handle
                development, testing, and security review. I act as the AI Engineer: defining
                requirements, overseeing the work, reviewing outputs, and making sure what gets built
                actually solves the problem we scoped. You get the speed and economics of AI-assisted
                development with a senior business mind in the loop.
              </p>
              <p>
                The result is an AI practice that speaks your language. I don&apos;t lead with
                models, APIs, or infrastructure. I lead with your use cases.
              </p>
            </div>

            <a
              href="https://www.linkedin.com/in/danplato"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-8 text-sm font-semibold text-primary-dark hover:text-text transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Connect on LinkedIn
              <ArrowRight size={13} className="opacity-60" />
            </a>
          </div>

          {/* Right: credential cards */}
          <div className="space-y-3">
            <CredentialCard
              label="Background"
              value="Management Consulting"
              detail="20+ years helping businesses improve operations and decision-making"
            />
            <CredentialCard
              label="Approach"
              value="Business-first"
              detail="Requirements and use cases defined before any development begins"
            />
            <CredentialCard
              label="Development"
              value="AI-assisted"
              detail="Claude-based agents handle build, test, and security review"
            />
            <CredentialCard
              label="My role"
              value="AI Engineer"
              detail="I oversee all agent work, own the requirements, and ensure quality"
            />
            <CredentialCard
              label="Based in"
              value="Cleveland, OH"
              detail="Serving small businesses nationally, remote-first"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function CredentialCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="font-semibold text-text mb-1">{value}</div>
      <div className="text-xs text-text-2 leading-relaxed">{detail}</div>
    </div>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="border-t border-border bg-surface/40 py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-text tracking-tight">
            Transparent, predictable pricing
          </h2>
          <p className="text-text-2 mt-4 leading-relaxed">
            You always pay your actual AI infrastructure costs directly (API, hosting, database).
            Our service fees cover the work of building, running, and improving your tools, with
            no hidden markups and no surprise invoices.
          </p>
        </div>

        {/* Step 1: Initial setup */}
        <div className="bg-surface-2 border border-border rounded-xl p-7 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <div className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-soft text-primary-dark mb-3">
                Step 1: Get started
              </div>
              <h3 className="font-semibold text-text text-base mb-1.5">Initial Setup</h3>
              <p className="text-text-2 text-sm leading-relaxed max-w-xl">
                Every engagement begins with a scoped onboarding: we learn your business,
                set up your AI infrastructure, and deliver your first working app. Scope and
                pricing are agreed before any work begins.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-muted mb-0.5">Starting from</div>
              <div className="text-2xl font-bold text-text">Custom</div>
              <div className="text-xs text-muted mt-0.5">scoped per engagement</div>
            </div>
          </div>
          <ul className="grid sm:grid-cols-3 gap-3 mt-5">
            {[
              "Business & technology discovery",
              "AI infrastructure setup",
              "First app built and delivered",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-text-2 bg-surface border border-border rounded-lg px-3.5 py-2.5">
                <CheckCircle size={13} className="text-success shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Step 2: Additional apps */}
        <div className="bg-surface-2 border border-border rounded-xl p-7 mb-5">
          <div className="mb-5">
            <div className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-soft text-primary-dark mb-3">
              Step 2: Expand
            </div>
            <h3 className="font-semibold text-text text-base mb-1.5">Additional Apps</h3>
            <p className="text-text-2 text-sm leading-relaxed max-w-xl">
              After your first app is live, additional tools are scoped and priced as standalone
              projects based on complexity. Every project is estimated before work begins.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <ProjectTier
              label="Minor"
              price="$500 – $1,000"
              desc="Simple automations, prompt-driven tools, single-workflow apps"
            />
            <ProjectTier
              label="Moderate"
              price="$1,000 – $3,000"
              desc="Multi-step workflows, integrations with existing systems, standalone tools"
            />
            <ProjectTier
              label="Major"
              price="$3,000+"
              desc="Full AI apps, client-facing tools, complex multi-system integrations"
            />
          </div>
        </div>

        {/* Step 3: Ongoing maintenance */}
        <div className="bg-surface-2 border border-border rounded-xl p-7">
          <div className="mb-6">
            <div className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-soft text-primary-dark mb-3">
              Step 3: Maintain
            </div>
            <h3 className="font-semibold text-text text-base mb-1.5">Ongoing Maintenance</h3>
            <p className="text-text-2 text-sm leading-relaxed max-w-xl">
              Once your tools are live, you can maintain them yourself or have us manage
              everything for you. Our managed tiers cover infrastructure monitoring, bug fixes,
              and ongoing improvements.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-lg p-5">
              <div className="text-sm font-semibold text-text mb-1.5">Self-managed</div>
              <div className="text-xl font-bold text-text mb-3">No fee</div>
              <p className="text-xs text-text-2 leading-relaxed">
                You own the infrastructure and code. Manage it on your own terms.
              </p>
            </div>
            <RetainerCard
              label="Base"
              price="$500 – $1,000"
              unit="/mo"
              features={[
                "Infrastructure monitoring",
                "Bug fixes & issue resolution",
                "Monthly usage reporting",
              ]}
            />
            <RetainerCard
              label="Enhanced"
              price="$1,000 – $1,500"
              unit="/mo"
              highlight
              features={[
                "Everything in Base",
                "Ongoing enhancements",
                "New features & integrations",
                "Priority response",
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function RetainerCard({
  label,
  price,
  unit,
  features,
  highlight = false,
}: {
  label: string;
  price: string;
  unit: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-5 border ${
        highlight ? "bg-text border-text" : "bg-surface border-border"
      }`}
    >
      <div
        className={`text-xs font-semibold mb-3 ${
          highlight ? "text-bg/60" : "text-muted"
        }`}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1 mb-4">
        <span className={`text-xl font-bold ${highlight ? "text-bg" : "text-text"}`}>
          {price}
        </span>
        <span className={`text-xs ${highlight ? "text-bg/50" : "text-muted"}`}>{unit}</span>
      </div>
      <ul className="space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs">
            <CheckCircle
              size={12}
              className={`mt-0.5 shrink-0 ${highlight ? "text-bg/50" : "text-success"}`}
            />
            <span className={highlight ? "text-bg/75" : "text-text-2"}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProjectTier({ label, price, desc }: { label: string; price: string; desc: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
        <span className="text-sm font-semibold text-text">{label}</span>
        <span className="text-sm font-bold text-primary-dark">{price}</span>
      </div>
      <p className="text-xs text-text-2 leading-relaxed">{desc}</p>
    </div>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="border-t border-border bg-text py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-bg tracking-tight mb-5">
          Ready to put AI to work?
        </h2>
        <p className="text-bg/70 max-w-xl mx-auto text-sm sm:text-base leading-relaxed mb-9">
          Start with a conversation. We&apos;ll figure out what AI can actually do for your business
          and what it would take to get there.
        </p>
        <a
          href="mailto:dan@danplato.com?subject=AI Office inquiry"
          className="inline-flex items-center gap-2 bg-bg hover:bg-surface text-text font-semibold px-7 py-3.5 rounded-lg text-sm transition-colors"
        >
          Get in touch
          <ArrowRight size={14} className="opacity-70" />
        </a>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-text border-t border-white/10 py-7">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <LogoMark size={20} className="[&_rect]:fill-bg [&_circle]:fill-[#c8a96e]" />
          <span className="text-sm font-semibold text-bg/80">AI Office</span>
        </div>
        <p className="text-xs text-bg/40">
          A service of Dan Plato Consulting LLC &middot; dan@danplato.com
        </p>
        <nav className="flex items-center gap-5">
          <Link href="#services" className="text-xs text-bg/50 hover:text-bg/80 transition-colors">Services</Link>
          <Link href="#pricing" className="text-xs text-bg/50 hover:text-bg/80 transition-colors">Pricing</Link>
          <Link href="/portal" className="text-xs text-bg/50 hover:text-bg/80 transition-colors">Client portal</Link>
          <Link href="/admin" className="text-xs text-bg/50 hover:text-bg/80 transition-colors">Admin</Link>
        </nav>
      </div>
    </footer>
  );
}
