import type { OS, Integration, QuestionnaireResponses } from "./types";

export interface StepTemplate {
  id: string;
  section: string;
  title: string;
  description: string;
  why: string;
  click_steps: string[];
  notes: string[];
  links: { label: string; url: string }[];
  target_urls: string[];
  completion_criteria: string;
  showIf?: (r: QuestionnaireResponses) => boolean;
  codeContent?: Partial<Record<OS, string>>;
}

export const STEP_TEMPLATES: StepTemplate[] = [
  // ── Core Infrastructure ───────────────────────────────────────────────
  {
    id: "claude-max",
    section: "infrastructure",
    title: "Confirm Your Claude Max Plan",
    description: "Claude Code — the engine behind everything in this guide — requires a Claude Max subscription. Confirm you have an active Max plan before continuing.",
    why: "Claude Code is what turns Claude from a chatbot into a personal assistant that takes actions. Max includes it at no extra cost.",
    click_steps: [
      "Go to claude.ai and sign in.",
      "Click your profile icon (top right) → Billing.",
      "Confirm you're on the Max plan ($100/mo). If not, upgrade before continuing.",
    ],
    notes: ["No API key or separate developer account needed — Max covers all usage in this guide."],
    links: [{ label: "claude.ai/billing", url: "https://claude.ai/settings/billing" }],
    target_urls: ["claude.ai", "claude.ai/settings/billing"],
    completion_criteria: "User has confirmed active Claude Max subscription",
  },
  {
    id: "node",
    section: "infrastructure",
    title: "Install Node.js",
    description: "Node.js is required to install Claude Code and most MCP connectors.",
    why: "Most integrations in this guide are npm packages. Node.js is the runtime that lets them run on your machine.",
    click_steps: [
      "Go to nodejs.org and click the LTS download button.",
      "Run the installer and accept all defaults.",
      "Restart your computer after the install finishes.",
    ],
    notes: ["Download the LTS version (left button) — it's the stable release."],
    links: [{ label: "Download Node.js LTS", url: "https://nodejs.org" }],
    target_urls: ["nodejs.org"],
    completion_criteria: "Node.js installed and `node --version` runs in terminal",
  },
  {
    id: "python",
    section: "infrastructure",
    title: "Install Python",
    description: "Python is required for the Windows MCP server and the Personal Knowledge Base server.",
    why: "Two components run on Python: the Windows MCP server (lets Claude interact with your OS) and the PKB memory server.",
    click_steps: [
      "Go to python.org/downloads and click the yellow Download button.",
      "Run the installer.",
      "⚠️ On the first screen, check 'Add Python to PATH' before clicking Install Now.",
      "Click Install Now and wait for it to finish.",
    ],
    notes: ["The PATH checkbox is near the bottom of the first installer screen and is unchecked by default — missing it causes problems."],
    links: [{ label: "Download Python", url: "https://www.python.org/downloads/" }],
    target_urls: ["python.org", "python.org/downloads"],
    completion_criteria: "Python installed with PATH configured; `python --version` runs in terminal",
    showIf: r => r.os === "windows" || r.integrations.includes("pkb"),
  },
  {
    id: "claude-desktop",
    section: "infrastructure",
    title: "Install Claude Desktop",
    description: "Claude Desktop is the application that hosts all your MCP connectors. It's the control panel for your entire setup.",
    why: "When you add a connector (Calendar, Gmail, GitHub, etc.), it gets saved in a config file that Claude Desktop manages. Claude Code reads that same file — so configuring Desktop once gives you those connections everywhere.",
    click_steps: [
      "Go to claude.ai/download and click the download button for your operating system.",
      "Run the installer and follow the prompts.",
      "Open Claude Desktop and sign in with your Claude.ai account.",
    ],
    notes: ["You'll come back to Claude Desktop's Settings → Connectors throughout this guide to add MCP servers."],
    links: [{ label: "Download Claude Desktop", url: "https://claude.ai/download" }],
    target_urls: ["claude.ai/download"],
    completion_criteria: "Claude Desktop installed and signed in",
  },
  {
    id: "claude-code",
    section: "infrastructure",
    title: "Install Claude Code",
    description: "Claude Code is Anthropic's command-line tool — it enables automations, Telegram, scheduled tasks, and everything that runs in the background.",
    why: "Claude Desktop handles the GUI and MCP connections. Claude Code is what enables everything that runs without you — receiving messages, executing scheduled tasks, running as a persistent background session.",
    click_steps: [
      "Open a terminal (PowerShell on Windows, Terminal on Mac).",
      "Run the install command below.",
      "Once installed, type `claude` and press Enter, then choose 'Sign in with Claude.ai'.",
      "Back in the terminal, type `hello` and press Enter to confirm it works.",
    ],
    notes: ["The install may take a minute. Wait for the prompt to return before typing `claude`."],
    links: [],
    target_urls: [],
    completion_criteria: "Claude Code installed; `claude --version` runs and user is authenticated",
    codeContent: {
      windows: "npm install -g @anthropic/claude-code",
      mac: "npm install -g @anthropic/claude-code",
      linux: "npm install -g @anthropic/claude-code",
    },
  },
  // ── Google ────────────────────────────────────────────────────────────
  {
    id: "google-oauth",
    section: "google",
    title: "Set Up Google OAuth",
    description: "Create a Google Cloud OAuth app so Claude can access your Google account. This is a one-time setup in Google Cloud Console.",
    why: "The Google MCP connectors need OAuth credentials to access your Gmail, Calendar, or Drive on your behalf. You create these credentials once and they work for all Google services you enable.",
    click_steps: [
      "Go to console.cloud.google.com and sign in with your Google account.",
      "Create a new project (or select an existing one) — name it something like 'Claude MCP'.",
      "In the sidebar, go to APIs & Services → OAuth consent screen.",
      "Select 'External' user type and fill in the app name ('Claude') and your email. Save.",
      "Go to APIs & Services → Credentials → Create Credentials → OAuth client ID.",
      "Choose 'Desktop app' as the application type. Name it and click Create.",
      "Download the JSON file — you'll need it in the next step.",
    ],
    notes: [
      "You only need to do this once, even if you have multiple Google accounts.",
      "Enable the specific APIs you need: Google Calendar API, Gmail API, Google Drive API.",
    ],
    links: [{ label: "Google Cloud Console", url: "https://console.cloud.google.com" }],
    target_urls: ["console.cloud.google.com"],
    completion_criteria: "OAuth client credentials JSON downloaded",
    showIf: r => r.google_enabled,
  },
  {
    id: "google-mcp",
    section: "google",
    title: "Install the Google MCP Connector",
    description: "Add the Google MCP server to Claude Desktop so Claude can read your Gmail, Calendar, and Drive.",
    why: "The Google MCP connector is what lets Claude actually read your email, check your calendar, and find files — without you having to copy-paste anything.",
    click_steps: [
      "Open Claude Desktop → Settings → Connectors.",
      "Search for 'Google' in the connector library.",
      "Click Install and follow the OAuth flow to connect your account(s).",
      "If you have multiple accounts, add each one separately.",
    ],
    notes: ["Each Google account needs its own connector entry."],
    links: [],
    target_urls: [],
    completion_criteria: "Google connector installed and at least one account authenticated",
    showIf: r => r.google_enabled,
  },
  // ── Developer Tools ───────────────────────────────────────────────────
  {
    id: "github",
    section: "developer",
    title: "Connect GitHub",
    description: "Install the GitHub MCP connector so Claude can browse repos, review PRs, search code, and manage issues.",
    why: "With GitHub connected, you can ask Claude to summarize a PR, find where a function is defined, or create an issue — without leaving your current context.",
    click_steps: [
      "Open Claude Desktop → Settings → Connectors.",
      "Search for 'GitHub' and click Install.",
      "Authenticate with your GitHub account when prompted.",
    ],
    notes: ["Claude gets read access to your repos by default. Write access (creating PRs, issues) requires additional OAuth scopes."],
    links: [],
    target_urls: [],
    completion_criteria: "GitHub connector installed and authenticated",
    showIf: r => r.integrations.includes("github"),
  },
  // ── Memory ────────────────────────────────────────────────────────────
  {
    id: "supabase-project",
    section: "memory",
    title: "Create a Supabase Project",
    description: "Supabase is where Claude's persistent memory (your Personal Knowledge Base) lives. Create a free project — it takes about 2 minutes.",
    why: "Without persistent memory, Claude forgets everything between sessions. The PKB lets Claude remember decisions you've made, facts you've told it, and context about your work.",
    click_steps: [
      "Go to supabase.com and create a free account (or sign in).",
      "Click 'New project' and choose a name like 'Claude Memory'.",
      "Set a strong database password and save it somewhere safe.",
      "Wait for the project to finish provisioning (about 60 seconds).",
      "Go to Settings → API and copy the Project URL and anon key — you'll need these next.",
    ],
    notes: ["The free tier is plenty for personal use."],
    links: [{ label: "Supabase", url: "https://supabase.com" }],
    target_urls: ["supabase.com", "app.supabase.com"],
    completion_criteria: "Supabase project created; Project URL and anon key saved",
    showIf: r => r.integrations.includes("pkb"),
  },
  {
    id: "pkb-setup",
    section: "memory",
    title: "Set Up the Knowledge Base",
    description: "Install and configure the PKB MCP server so Claude can save and search memories across all sessions.",
    why: "The PKB turns Claude from a stateless chatbot into a system that actually knows you. It remembers your preferences, past decisions, and important context.",
    click_steps: [
      "Open Claude Desktop → Settings → Connectors.",
      "Search for 'PKB' or 'Knowledge Base' and install it.",
      "Enter your Supabase Project URL and anon key when prompted.",
      "Claude will automatically create the database table on first use.",
    ],
    notes: [
      "Once connected, tell Claude to save something: 'Remember that I prefer dark mode'. Then start a new session and ask 'What do I prefer about UI?' — it should recall it.",
    ],
    links: [],
    target_urls: [],
    completion_criteria: "PKB connector installed; Claude can save and retrieve memories",
    showIf: r => r.integrations.includes("pkb"),
  },
  {
    id: "claude-md",
    section: "memory",
    title: "Write Your CLAUDE.md",
    description: "CLAUDE.md is a file you create in your home directory that tells Claude who you are, how you want to communicate, and what tools are connected.",
    why: "Claude reads CLAUDE.md at the start of every Claude Code session. It's how Claude knows your name, your timezone, your communication preferences, and which MCP tools to use without you explaining every time.",
    click_steps: [
      "Open a terminal.",
      "Run `claude` to open Claude Code.",
      "Ask Claude to help you write a CLAUDE.md: 'Help me create a CLAUDE.md file. Ask me questions about my setup and preferences.'",
      "Claude will ask you questions and generate the file.",
    ],
    notes: [
      "You can always edit CLAUDE.md later — it's just a text file in your home directory.",
      "The more detail you put in, the better Claude will behave by default.",
    ],
    links: [],
    target_urls: [],
    completion_criteria: "CLAUDE.md created at ~/CLAUDE.md (or C:\\Users\\{name}\\CLAUDE.md on Windows)",
  },
  // ── Phone ─────────────────────────────────────────────────────────────
  {
    id: "telegram-bot",
    section: "phone",
    title: "Create a Telegram Bot",
    description: "Create a Telegram bot that connects to your Claude instance so you can message Claude from your phone.",
    why: "With Telegram connected, you can text Claude from anywhere — ask it to check your calendar, look something up, or run a task — and it'll reply with your full MCP tool stack available.",
    click_steps: [
      "Open Telegram and search for '@BotFather'.",
      "Send '/newbot' and follow the prompts to create your bot.",
      "Copy the bot token BotFather gives you.",
      "Follow the Claude Code Telegram setup guide to connect the bot to your Claude instance.",
    ],
    notes: ["Your Telegram messages go directly to your local Claude — they don't go through any third-party service."],
    links: [{ label: "Telegram BotFather", url: "https://t.me/BotFather" }],
    target_urls: ["t.me/BotFather", "telegram.org"],
    completion_criteria: "Telegram bot created and connected to Claude Code",
    showIf: r => r.integrations.includes("telegram"),
  },
  // ── Automation ────────────────────────────────────────────────────────
  {
    id: "scheduled-workflows",
    section: "automation",
    title: "Set Up Scheduled Workflows",
    description: "Configure Claude to run tasks automatically on a schedule — daily digests, health checks, action item reviews.",
    why: "Scheduled workflows turn Claude from a reactive tool into a proactive assistant. Instead of asking Claude to check your email every morning, it just does it and sends you a summary.",
    click_steps: [
      "Open Claude Code and run `/schedule` to see available workflow options.",
      "Set up a daily digest: ask Claude 'Create a daily digest that checks my calendar and email each morning at 8am.'",
      "Review the scheduled task and approve it.",
    ],
    notes: [
      "Scheduled tasks run as background Claude Code sessions with your full MCP stack.",
      "You can review, modify, or delete schedules anytime with `/schedule list`.",
    ],
    links: [],
    target_urls: [],
    completion_criteria: "At least one scheduled workflow created and confirmed running",
    showIf: r => r.integrations.includes("workflows"),
  },
  // ── Finish ────────────────────────────────────────────────────────────
  {
    id: "connect-extension",
    section: "finish",
    title: "Connect the AI Office Extension",
    description: "Install the AI Office Chrome extension and link it to your account. The extension gives Claude live context about whatever page you're on.",
    why: "With the extension connected, Claude knows what you're looking at. You can ask 'What should I do on this page?' and get step-specific guidance — or run quick actions like Summarize or Key Facts on any page.",
    click_steps: [
      "Install the AI Office Chrome extension from the link below.",
      "Click the AI Office icon in your toolbar to open the side panel.",
      "Enter your companion server URL (default: http://127.0.0.1:7848).",
      "Paste your AI Office token from your dashboard.",
      "Click Connect — the status dot should turn green.",
    ],
    notes: ["Your companion server must be running for the extension to connect. Start it with: `python server/server.py`"],
    links: [],
    target_urls: ["aioffice.app"],
    completion_criteria: "Extension installed, companion server running, status dot green",
  },
  {
    id: "first-session",
    section: "finish",
    title: "Run Your First Full Session",
    description: "Open Claude Code and try a real task that uses your connected tools. This confirms everything is wired up correctly.",
    why: "The best way to verify your setup is to actually use it. A real task will exercise your MCP connections and show you what Claude can now do.",
    click_steps: [
      "Open a terminal and run `claude`.",
      "Try one of these: 'What's on my calendar today?' / 'Summarize my last 3 emails' / 'What did I save to memory about my preferences?'",
      "If Claude uses your MCP tools (you'll see it calling them), your setup is working.",
    ],
    notes: ["If Claude can't access a tool, check Claude Desktop → Connectors to make sure it's installed and authenticated."],
    links: [],
    target_urls: [],
    completion_criteria: "Claude successfully uses at least one connected MCP tool in a live session",
  },
];
