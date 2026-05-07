export type OS = "mac" | "windows";
export type StepStatus = "pending" | "in_progress" | "complete" | "skipped";
export type StepSection =
  | "infrastructure"
  | "google"
  | "microsoft"
  | "developer"
  | "memory"
  | "phone"
  | "automation"
  | "creative"
  | "finance"
  | "notetaking"
  | "finish";

export interface EmailAccount {
  email: string;
  provider: "google" | "microsoft" | "other";
  account_type: "work" | "personal";
  has_admin_control: boolean;
}

export interface Briefing {
  title: string;
  preferred_time: string;
  topics: string[];
}

export interface QuestionnaireResponses {
  // Step 1: About You
  name: string;
  os: OS;
use_case: "work" | "personal" | "both";
  // Step 2: Quick Check
  has_claude_account: boolean;
  has_claude_desktop: boolean;
  has_admin_access: boolean;
  // Step 3: Categories
  categories: string[];
  // Email & Calendar (Productivity)
  email_accounts: EmailAccount[];
  google_gmail: boolean;
  google_calendar: boolean;
  google_drive: boolean;
  microsoft_outlook: boolean;
  microsoft_calendar: boolean;
  microsoft_sharepoint: boolean;
  // Note-taking (Productivity)
  note_taking_tool: string | null;
  note_taking_other: string;
  wants_note_taking_setup: boolean;
  // Briefings & Action Items (Productivity)
  wants_briefings: boolean;
  briefings: Briefing[];
  wants_action_items: boolean;
  action_item_delivery: string[];
  // Messaging (Productivity)
  messaging_app: "telegram" | "whatsapp" | null;
  // PKB
  pkb: boolean;
  // Document Creation
  wants_doc_editing: boolean;
  wants_file_organization: boolean;
  // App Dev
  wants_app_dev: boolean;
  github: boolean;
  supabase_db: boolean;
  vercel: boolean;
  apps_publicly_accessible: boolean | null;
  apps_need_data_storage: boolean | null;
  app_user_count: string | null;
  // Creative
  creative_tools: string[];
  // Finance
  finance_tools: string[];
  finance_other: string;
  // Step N: Goal
  goal: string;
}

export interface SetupStep {
  id: string;
  guide_id: string;
  step_number: number;
  section: StepSection;
  title: string;
  description: string | null;
  why: string | null;
  click_steps: string[];
  code_blocks: CodeBlock[];
  notes: string[];
  links: StepLink[];
  target_urls: string[];
  completion_criteria: string | null;
  status: StepStatus;
  completed_at: string | null;
  created_at: string;
}

export interface CodeBlock {
  label?: string;
  filename?: string;
  content: string;
}

export interface StepLink {
  label: string;
  url: string;
}

export interface SetupGuide {
  id: string;
  user_id: string;
  generated_at: string;
  pdf_url: string | null;
  steps?: SetupStep[];
}

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  os: OS | null;
  created_at: string;
}

export interface ExtensionToken {
  id: string;
  user_id: string;
  token: string;
  last_used_at: string | null;
  created_at: string;
}

export const SECTION_LABELS: Record<StepSection, string> = {
  infrastructure: "Core Infrastructure",
  google: "Google Integrations",
  microsoft: "Microsoft 365",
  developer: "Developer Tools",
  memory: "Persistent Memory",
  phone: "Phone Integration",
  automation: "Automation & Briefings",
  creative: "Creative Tools",
  finance: "Personal Finance",
  notetaking: "Note-taking & Knowledge",
  finish: "Finishing Up",
};

export const SECTION_ORDER: StepSection[] = [
  "infrastructure",
  "google",
  "microsoft",
  "developer",
  "memory",
  "phone",
  "automation",
  "creative",
  "finance",
  "notetaking",
  "finish",
];
