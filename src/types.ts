export type FunnelStep = 1 | 2 | 3;

export type PrototypeStatus = 'not_started' | 'building' | 'verified';

export type ModelTier = 'Flash' | 'Pro / Claude';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type AccountProvider =
  | 'Google'
  | 'GitHub'
  | 'Claude / Anthropic'
  | 'OpenAI'
  | 'OpenRouter'
  | 'Groq'
  | 'Local Ollama'
  | 'Other / Local';

export type QuotaMode =
  | '5h Pro Cycle'
  | 'Free Tier'
  | 'API / Pay-as-you-go'
  | 'Local / Unlimited';

export type CycleStatus = 'idle' | 'running' | 'paused' | 'expired';

export type ApiFormat = 'gemini-builtin' | 'openai-compatible' | 'anthropic';

export type AiProviderKind =
  | 'Google Built-in'
  | 'OpenAI'
  | 'OpenRouter'
  | 'Anthropic'
  | 'Groq'
  | 'Local Ollama'
  | 'Custom';

export interface AiProviderProfile {
  id: string;
  label: string;
  providerKind: AiProviderKind;
  apiFormat: ApiFormat;
  baseUrl: string;
  modelId: string;
  envVarName: string; // Name of server env var only (e.g. OPENROUTER_API_KEY), never secret value
}

export interface AiRunMetric {
  id: string;
  action: string;
  providerLabel: string;
  modelUsed: string;
  latencyMs: number;
  tokensSaved: number;
  timestamp: string;
}

export interface ProviderServerStatus {
  geminiReady: boolean;
  envStatus: Record<string, boolean>;
  recommendedModels: {
    fast: string;
    balanced: string;
  };
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface Step1Data {
  prdText: string;
  researchNotes: string;
  checklist: ChecklistItem[];
  isLocked: boolean;
  lockedAt?: string;
}

export interface PromptVariant {
  id: string;
  title: string;
  content: string;
  isProduction: boolean;
}

export interface Step2Data {
  prototypeStatus: PrototypeStatus;
  exportReady: boolean;
  repoUrl: string;
  prompts: PromptVariant[];
  isConfirmed: boolean;
  confirmedAt?: string;
}

export interface AntigravityTask {
  id: string;
  title: string;
  targetFiles: string;
  modelTier: ModelTier;
  prompt: string;
  status: TaskStatus;
  reviewedDiff: boolean;
  createdAt: string;
}

export interface Step3Data {
  tasks: AntigravityTask[];
}

export interface Project {
  id: string;
  name: string;
  summary: string;
  currentStep: FunnelStep;
  updatedAt: string;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
}

export interface AccountProfile {
  id: string;
  label: string;
  emailOrHandle: string;
  provider: AccountProvider;
  quotaMode: QuotaMode;
  lastActiveAt: string;
  sessionNote: string;
}

export interface QuotaCycleState {
  status: CycleStatus;
  durationMs: number;
  remainingMs: number;
  endTimestamp: number | null;
}

export interface HandoffCheckpoint {
  id: string;
  timestamp: string;
  fromAccountLabel: string;
  toAccountLabel: string;
  projectId: string;
  projectName: string;
  funnelStep: FunnelStep;
  nextTaskTitle: string;
  note: string;
}

export interface AppSnapshot {
  version: number;
  exportedAt: string;
  projects: Project[];
  activeProjectId: string;
  accounts: AccountProfile[];
  activeAccountId: string;
  cycleState: QuotaCycleState;
  checkpoints: HandoffCheckpoint[];
  aiProviders: AiProviderProfile[];
  activeAiProviderId: string;
  aiMetrics: AiRunMetric[];
}

export interface GateCheckResult {
  allowed: boolean;
  blockers: string[];
}

export type LinterSeverity = 'error' | 'warning' | 'ok';

export interface LinterIssue {
  id: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface LinterAnalysis {
  severity: LinterSeverity;
  issues: LinterIssue[];
  matchedVaguePhrases: string[];
  suggestedTemplate: string;
}
