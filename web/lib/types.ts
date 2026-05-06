export type OS = "mac" | "windows" | "linux";
export type Integration = "github" | "pkb" | "telegram" | "finance" | "workflows";
export type StepStatus = "pending" | "in_progress" | "complete" | "skipped";
export type StepSection =
  | "infrastructure"
  | "google"
  | "developer"
  | "memory"
  | "phone"
  | "automation"
  | "finish";

export interface GoogleAccount {
  email: string;
  type: "personal" | "work";
}

export interface QuestionnaireResponses {
  name: string;
  os: OS;
  use_cases: string[];
  google_enabled: boolean;
  google_calendar: boolean;
  google_gmail: boolean;
  google_drive: boolean;
  google_accounts: GoogleAccount[];
  integrations: Integration[];
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
  developer: "Developer Tools",
  memory: "Persistent Memory",
  phone: "Phone Integration",
  automation: "Automation",
  finish: "Finishing Up",
};

export const SECTION_ORDER: StepSection[] = [
  "infrastructure",
  "google",
  "developer",
  "memory",
  "phone",
  "automation",
  "finish",
];
