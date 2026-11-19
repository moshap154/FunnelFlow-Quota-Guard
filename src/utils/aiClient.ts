import {
  AiProviderProfile,
  ModelTier,
  ProviderServerStatus,
} from '../types';

export interface AiMeta {
  providerLabel: string;
  modelUsed: string;
  latencyMs: number;
}

export interface GenerateProjectAiResponse {
  prdText: string;
  researchNotes: string;
  checklistLabels: string[];
  prompts: Array<{ title: string; content: string; isProduction: boolean }>;
  tasks: Array<{
    title: string;
    targetFiles: string;
    modelTier: ModelTier;
    prompt: string;
  }>;
  meta: AiMeta;
}

export interface Step1AssistAiResponse {
  prdAdditions: string;
  riskNotes: string;
  suggestedChecklistItems: string[];
  meta: AiMeta;
}

export interface CompressPromptAiResponse {
  compressedTitle: string;
  compressedPrompt: string;
  rationale: string;
  meta: AiMeta;
}

export interface RewriteScopeAiResponse {
  scopedPrompt: string;
  suggestedTargetFiles: string;
  recommendedTier: ModelTier;
  explanation: string;
  meta: AiMeta;
}

export interface HandoffBriefAiResponse {
  brief: string;
  meta: AiMeta;
}

async function postAi<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  provider?: AiProviderProfile
): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      providerConfig: provider
        ? {
            id: provider.id,
            label: provider.label,
            apiFormat: provider.apiFormat,
            baseUrl: provider.baseUrl,
            modelId: provider.modelId,
            envVarName: provider.envVarName,
          }
        : undefined,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `API lỗi (${res.status})`);
  }
  return data;
}

export async function fetchProviderStatus(
  envVars: string[]
): Promise<ProviderServerStatus> {
  const query = envVars.filter(Boolean).join(',');
  const url = query
    ? `/api/ai/providers/status?envVars=${encodeURIComponent(query)}`
    : '/api/ai/providers/status';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Không thể kiểm tra trạng thái AI (${res.status})`);
  }
  return (await res.json()) as ProviderServerStatus;
}

export function aiGenerateProject(
  name: string,
  brief: string,
  provider?: AiProviderProfile
): Promise<GenerateProjectAiResponse> {
  return postAi<GenerateProjectAiResponse>(
    '/api/ai/generate-project',
    { name, brief },
    provider
  );
}

export function aiStep1Assist(
  payload: {
    projectName: string;
    prdText: string;
    researchNotes: string;
    checklist: string[];
  },
  provider?: AiProviderProfile
): Promise<Step1AssistAiResponse> {
  return postAi<Step1AssistAiResponse>('/api/ai/step1-assist', payload, provider);
}

export function aiCompressPrompt(
  payload: {
    promptText: string;
    projectName: string;
  },
  provider?: AiProviderProfile
): Promise<CompressPromptAiResponse> {
  return postAi<CompressPromptAiResponse>(
    '/api/ai/compress-prompt',
    payload,
    provider
  );
}

export function aiRewriteScope(
  payload: {
    taskTitle: string;
    targetFiles: string;
    rawPrompt: string;
    modelTier: ModelTier;
  },
  provider?: AiProviderProfile
): Promise<RewriteScopeAiResponse> {
  return postAi<RewriteScopeAiResponse>('/api/ai/rewrite-scope', payload, provider);
}

export function aiSynthesizeHandoffBrief(
  payload: {
    accountLabel: string;
    provider: string;
    quotaMode: string;
    projectName: string;
    funnelStep: number;
    nextTaskTitle: string;
    targetFiles: string;
    remainingTime: string;
    sessionNote: string;
  },
  providerConfig?: AiProviderProfile
): Promise<HandoffBriefAiResponse> {
  return postAi<HandoffBriefAiResponse>(
    '/api/ai/handoff-brief',
    payload,
    providerConfig
  );
}
