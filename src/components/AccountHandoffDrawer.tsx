import React, { useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Cpu,
  Download,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AccountProfile,
  AccountProvider,
  AiProviderKind,
  AiProviderProfile,
  AiRunMetric,
  ApiFormat,
  AppSnapshot,
  HandoffCheckpoint,
  Project,
  ProviderServerStatus,
  QuotaCycleState,
  QuotaMode,
} from '../types';
import { aiSynthesizeHandoffBrief } from '../utils/aiClient';
import {
  buildHandoffBrief,
  createId,
  formatCountdown,
  formatRelativeTime,
  validateSnapshot,
} from '../utils/quotaHelpers';

interface AccountHandoffDrawerProps {
  isOpen: boolean;
  initialTab?: 'accounts' | 'providers';
  onClose: () => void;
  accounts: AccountProfile[];
  activeAccountId: string;
  onSwitchAccount: (accountId: string) => void;
  onAddAccount: (payload: {
    label: string;
    emailOrHandle: string;
    provider: AccountProvider;
    quotaMode: QuotaMode;
    sessionNote: string;
  }) => void;
  onUpdateAccountNote: (accountId: string, note: string) => void;
  onDeleteAccount: (accountId: string) => void;
  activeProject: Project | undefined;
  cycleState: QuotaCycleState;
  checkpoints: HandoffCheckpoint[];
  onRecordManualCheckpoint: () => void;
  onCopyText: (text: string, label: string) => void;
  fullSnapshot: AppSnapshot;
  onImportSnapshot: (snapshot: AppSnapshot, mode: 'merge' | 'replace') => void;
  aiProviders: AiProviderProfile[];
  activeAiProviderId: string;
  serverStatus: ProviderServerStatus | null;
  onRefreshServerStatus: () => void;
  onSelectAiProvider: (providerId: string) => void;
  onAddAiProvider: (provider: Omit<AiProviderProfile, 'id'>) => void;
  onDeleteAiProvider: (providerId: string) => void;
  onRecordAiMetric: (metric: AiRunMetric, toastMessage?: string) => void;
}

const ACCOUNT_PROVIDERS: AccountProvider[] = [
  'Google',
  'GitHub',
  'Claude / Anthropic',
  'OpenAI',
  'OpenRouter',
  'Groq',
  'Local Ollama',
  'Other / Local',
];

const QUOTA_MODES: QuotaMode[] = [
  '5h Pro Cycle',
  'Free Tier',
  'API / Pay-as-you-go',
  'Local / Unlimited',
];

const PRESET_3P_TEMPLATES: Record<
  Exclude<AiProviderKind, 'Google Built-in'>,
  { apiFormat: ApiFormat; baseUrl: string; modelId: string; envVarName: string }
> = {
  OpenRouter: {
    apiFormat: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'anthropic/claude-3.5-sonnet',
    envVarName: 'OPENROUTER_API_KEY',
  },
  OpenAI: {
    apiFormat: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o-mini',
    envVarName: 'OPENAI_API_KEY',
  },
  Anthropic: {
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    modelId: 'claude-3-5-sonnet-latest',
    envVarName: 'ANTHROPIC_API_KEY',
  },
  Groq: {
    apiFormat: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelId: 'llama-3.3-70b-versatile',
    envVarName: 'GROQ_API_KEY',
  },
  'Local Ollama': {
    apiFormat: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    modelId: 'qwen2.5-coder:7b',
    envVarName: '',
  },
  Custom: {
    apiFormat: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    modelId: 'custom-model-id',
    envVarName: 'CUSTOM_AI_API_KEY',
  },
};

export const AccountHandoffDrawer: React.FC<AccountHandoffDrawerProps> = ({
  isOpen,
  initialTab = 'accounts',
  onClose,
  accounts,
  activeAccountId,
  onSwitchAccount,
  onAddAccount,
  onUpdateAccountNote,
  onDeleteAccount,
  activeProject,
  cycleState,
  checkpoints,
  onRecordManualCheckpoint,
  onCopyText,
  fullSnapshot,
  onImportSnapshot,
  aiProviders,
  activeAiProviderId,
  serverStatus,
  onRefreshServerStatus,
  onSelectAiProvider,
  onAddAiProvider,
  onDeleteAiProvider,
  onRecordAiMetric,
}) => {
  const [drawerTab, setDrawerTab] = useState<'accounts' | 'providers'>(initialTab);

  // Sync tab when drawer opens with a specific target tab
  React.useEffect(() => {
    if (isOpen) {
      setDrawerTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Add account state
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState('');
  const [emailOrHandle, setEmailOrHandle] = useState('');
  const [provider, setProvider] = useState<AccountProvider>('Google');
  const [quotaMode, setQuotaMode] = useState<QuotaMode>('5h Pro Cycle');
  const [newNote, setNewNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Add 3rd-party API provider state
  const [showAddProviderForm, setShowAddProviderForm] = useState(false);
  const [provKind, setProvKind] =
    useState<Exclude<AiProviderKind, 'Google Built-in'>>('OpenRouter');
  const [provLabel, setProvLabel] = useState('');
  const [provBaseUrl, setProvBaseUrl] = useState(
    PRESET_3P_TEMPLATES.OpenRouter.baseUrl
  );
  const [provModelId, setProvModelId] = useState(
    PRESET_3P_TEMPLATES.OpenRouter.modelId
  );
  const [provEnvVar, setProvEnvVar] = useState(
    PRESET_3P_TEMPLATES.OpenRouter.envVarName
  );
  const [provError, setProvError] = useState<string | null>(null);

  // AI Handoff Brief state
  const [isSynthesizingBrief, setIsSynthesizingBrief] = useState(false);
  const [aiBriefPreview, setAiBriefPreview] = useState<string | null>(null);
  const [aiBriefError, setAiBriefError] = useState<string | null>(null);

  // Snapshot Import/Export state
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [importFeedback, setImportFeedback] = useState<{
    type: 'ok' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const activeAiProvider = aiProviders.find((p) => p.id === activeAiProviderId);

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (label.trim().length < 2 || emailOrHandle.trim().length < 2) {
      setFormError(
        'Vui lòng nhập tên gợi nhớ và Email/Handle của tài khoản (Account label & handle required).'
      );
      return;
    }
    onAddAccount({
      label: label.trim(),
      emailOrHandle: emailOrHandle.trim(),
      provider,
      quotaMode,
      sessionNote: newNote.trim(),
    });
    setLabel('');
    setEmailOrHandle('');
    setProvider('Google');
    setQuotaMode('5h Pro Cycle');
    setNewNote('');
    setFormError(null);
    setShowAddForm(false);
  };

  const handleProviderKindChange = (
    nextKind: Exclude<AiProviderKind, 'Google Built-in'>
  ) => {
    setProvKind(nextKind);
    const tpl = PRESET_3P_TEMPLATES[nextKind];
    setProvBaseUrl(tpl.baseUrl);
    setProvModelId(tpl.modelId);
    setProvEnvVar(tpl.envVarName);
    setProvError(null);
  };

  const handleCreateProvider = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = provLabel.trim() || `${provKind} (${provModelId.trim()})`;
    const cleanUrl = provBaseUrl.trim();
    const cleanModel = provModelId.trim();
    const cleanEnv = provEnvVar.trim().toUpperCase();

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setProvError('Endpoint URL phải bắt đầu bằng http:// hoặc https://.');
      return;
    }
    if (!cleanModel) {
      setProvError('Vui lòng nhập Model ID (ví dụ: gpt-4o-mini).');
      return;
    }
    if (cleanEnv && !/^[A-Z][A-Z0-9_]{1,63}$/.test(cleanEnv)) {
      setProvError(
        'Tên biến môi trường chỉ chứa chữ IN HOA, số và gạch dưới (VD: OPENROUTER_API_KEY).'
      );
      return;
    }

    onAddAiProvider({
      label: cleanLabel,
      providerKind: provKind,
      apiFormat: PRESET_3P_TEMPLATES[provKind].apiFormat,
      baseUrl: cleanUrl,
      modelId: cleanModel,
      envVarName: cleanEnv,
    });

    setProvLabel('');
    setProvError(null);
    setShowAddProviderForm(false);
  };

  const handleCopyBrief = () => {
    const brief = buildHandoffBrief(activeProject, activeAccount, cycleState);
    onCopyText(brief, 'Tóm tắt Bàn giao (Handoff Brief)');
  };

  const handleAiSmartHandoff = async () => {
    setAiBriefError(null);
    setIsSynthesizingBrief(true);
    try {
      const nextTask = activeProject?.step3.tasks.find((t) => t.status !== 'done');
      const res = await aiSynthesizeHandoffBrief(
        {
          accountLabel: activeAccount?.label ?? 'N/A',
          provider: activeAccount?.provider ?? 'Google',
          quotaMode: activeAccount?.quotaMode ?? '5h Pro Cycle',
          projectName: activeProject?.name ?? 'Chưa chọn',
          funnelStep: activeProject?.currentStep ?? 1,
          nextTaskTitle: nextTask?.title ?? 'Không có tác vụ tồn đọng',
          targetFiles: nextTask?.targetFiles ?? 'N/A',
          remainingTime: formatCountdown(cycleState.remainingMs),
          sessionNote: activeAccount?.sessionNote ?? '',
        },
        activeAiProvider
      );
      setAiBriefPreview(res.brief);
      onCopyText(res.brief, 'AI Smart Handoff Brief');
      onRecordAiMetric({
        id: createId('met'),
        action: 'Tổng hợp Handoff Brief',
        providerLabel: res.meta.providerLabel,
        modelUsed: res.meta.modelUsed,
        latencyMs: res.meta.latencyMs,
        tokensSaved: 0,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      setAiBriefError(
        err instanceof Error
          ? err.message
          : 'Không thể tổng hợp Handoff Brief bằng AI.'
      );
    } finally {
      setIsSynthesizingBrief(false);
    }
  };

  const handleDownloadJson = () => {
    const serialized = JSON.stringify(fullSnapshot, null, 2);
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateSlug = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `funnelflow-snapshot-${dateSlug}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const processJsonText = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const valid = validateSnapshot(parsed);
      if (!valid) {
        setImportFeedback({
          type: 'error',
          text: 'Cấu trúc JSON không hợp lệ hoặc thiếu trường projects/accounts (Invalid snapshot schema).',
        });
        return;
      }
      onImportSnapshot(valid, importMode);
      setImportFeedback({
        type: 'ok',
        text:
          importMode === 'merge'
            ? `Đã gộp an toàn ${valid.projects.length} dự án và ${valid.accounts.length} tài khoản (Merged safely).`
            : `Đã khôi phục toàn bộ ${valid.projects.length} dự án và ${valid.accounts.length} tài khoản (Replaced snapshot).`,
      });
      setRawJsonInput('');
    } catch {
      setImportFeedback({
        type: 'error',
        text: 'Không thể phân tích cú pháp JSON. Vui lòng kiểm tra lại nội dung tệp (JSON parse error).',
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        processJsonText(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const providerBadgeTone = (prov: AccountProvider) => {
    switch (prov) {
      case 'Google':
        return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
      case 'Claude / Anthropic':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
      case 'GitHub':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      case 'OpenAI':
      case 'OpenRouter':
      case 'Groq':
        return 'border-slate-600 bg-slate-800 text-slate-200';
      default:
        return 'border-slate-700 bg-slate-900 text-slate-300';
    }
  };

  const checkApiReady = (prov: AiProviderProfile): boolean | null => {
    if (!serverStatus) return null;
    if (prov.apiFormat === 'gemini-builtin') return serverStatus.geminiReady;
    if (!prov.envVarName) {
      return (
        prov.baseUrl.includes('localhost') || prov.baseUrl.includes('127.0.0.1')
      );
    }
    return Boolean(serverStatus.envStatus[prov.envVarName]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-drawer-title"
    >
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      <aside className="flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-900 shadow-2xl">
        {/* Drawer Header */}
        <div className="border-b border-slate-800 px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <h2
                id="account-drawer-title"
                className="font-display text-base font-bold text-slate-50"
              >
                Tài Khoản, Bàn Giao & Nguồn API (Accounts & AI Engines)
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng ngăn kéo (Close drawer)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Drawer Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setDrawerTab('accounts')}
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors ${
                drawerTab === 'accounts'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tài khoản & Handoff ({accounts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab('providers')}
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors ${
                drawerTab === 'providers'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nguồn AI & API 3rd-Party ({aiProviders.length})</span>
            </button>
          </div>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {drawerTab === 'accounts' ? (
            <>
              {/* Quick Handoff Actions */}
              <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-300">
                    Bàn Giao Không Gián Đoạn (Non-Stop Handoff)
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {checkpoints.length} mốc đã lưu
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBrief}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Sao chép Brief</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSynthesizingBrief}
                    onClick={handleAiSmartHandoff}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 whitespace-nowrap"
                  >
                    {isSynthesizingBrief ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>
                      {isSynthesizingBrief
                        ? 'Đang tổng hợp Brief...'
                        : 'Tổng hợp & Copy Brief bằng AI'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onRecordManualCheckpoint}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                  >
                    <History className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Ghi mốc</span>
                  </button>
                </div>

                {aiBriefPreview && (
                  <pre className="whitespace-pre-wrap rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 font-mono text-[11px] leading-relaxed text-emerald-100">
                    {aiBriefPreview}
                  </pre>
                )}

                {aiBriefError && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-200">
                    {aiBriefError}
                  </div>
                )}

                {activeAccount && (
                  <div className="space-y-1.5 pt-1">
                    <label
                      htmlFor="active-account-note"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Ghi chú phiên cho "{activeAccount.label}" (Per-Account Session Note)
                    </label>
                    <textarea
                      id="active-account-note"
                      rows={2}
                      value={activeAccount.sessionNote}
                      onChange={(e) =>
                        onUpdateAccountNote(activeAccount.id, e.target.value)
                      }
                      placeholder="Ví dụ: Đã chạy xong migration, chuyển sang tài khoản phụ để làm UI..."
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </div>
                )}
              </section>

              {/* Account Profiles & 1-Click Switcher */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-slate-100">
                    Hồ Sơ Tài Khoản (Account Profiles)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddForm((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                    <span>
                      {showAddForm ? 'Đóng biểu mẫu' : 'Thêm tài khoản (Add Account)'}
                    </span>
                  </button>
                </div>

                {showAddForm && (
                  <form
                    onSubmit={handleCreateAccount}
                    className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor="acc-label"
                          className="block text-xs font-medium text-slate-300"
                        >
                          Tên gợi nhớ (Label)
                        </label>
                        <input
                          id="acc-label"
                          type="text"
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder="VD: Google Phụ #2 / OpenRouter"
                          className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="acc-handle"
                          className="block text-xs font-medium text-slate-300"
                        >
                          Email hoặc Handle (Email / Handle)
                        </label>
                        <input
                          id="acc-handle"
                          type="text"
                          value={emailOrHandle}
                          onChange={(e) => setEmailOrHandle(e.target.value)}
                          placeholder="dev2@gmail.com hoặc @handle"
                          className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor="acc-provider"
                          className="block text-xs font-medium text-slate-300"
                        >
                          Nhà cung cấp (Provider)
                        </label>
                        <select
                          id="acc-provider"
                          value={provider}
                          onChange={(e) =>
                            setProvider(e.target.value as AccountProvider)
                          }
                          className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          {ACCOUNT_PROVIDERS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="acc-quota-mode"
                          className="block text-xs font-medium text-slate-300"
                        >
                          Chế độ hạn mức (Quota Mode)
                        </label>
                        <select
                          id="acc-quota-mode"
                          value={quotaMode}
                          onChange={(e) =>
                            setQuotaMode(e.target.value as QuotaMode)
                          }
                          className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          {QUOTA_MODES.map((q) => (
                            <option key={q} value={q}>
                              {q}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="acc-note"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Ghi chú ban đầu (Session Note - Optional)
                      </label>
                      <input
                        id="acc-note"
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Ghi chú vai trò của tài khoản này..."
                        className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </div>

                    {formError && (
                      <p className="text-xs text-rose-300">{formError}</p>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Lưu Tài khoản (Save Profile)</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/70">
                  {accounts.map((acc) => {
                    const isActive = acc.id === activeAccountId;
                    return (
                      <div
                        key={acc.id}
                        className={`flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                          isActive ? 'bg-slate-900/90' : ''
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-100 truncate">
                              {acc.label}
                            </span>
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${providerBadgeTone(
                                acc.provider
                              )}`}
                            >
                              {acc.provider}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {acc.quotaMode}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                            <span>{acc.emailOrHandle}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              Hoạt động: {formatRelativeTime(acc.lastActiveAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isActive ? (
                            <span className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-300">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Đang dùng (Active)</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSwitchAccount(acc.id)}
                              className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-100 hover:border-sky-500/50 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                            >
                              Chuyển sang (Switch)
                            </button>
                          )}

                          {!isActive && accounts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeleteAccount(acc.id)}
                              aria-label={`Xóa tài khoản ${acc.label}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-500 hover:border-rose-500/40 hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Auto Handoff Checkpoints Log */}
              <section className="space-y-2.5">
                <h3 className="font-display text-sm font-bold text-slate-100">
                  Nhật Ký Mốc Bàn Giao (Handoff Checkpoints)
                </h3>
                {checkpoints.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-500">
                    Chưa có mốc bàn giao nào. Mỗi lần chuyển tài khoản hệ thống sẽ tự ghi lại một mốc tại đây.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/70">
                    {checkpoints.slice(0, 5).map((cp) => (
                      <div key={cp.id} className="space-y-1 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2 text-slate-400">
                          <span className="font-medium text-slate-200">
                            {cp.fromAccountLabel} → {cp.toAccountLabel}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums shrink-0">
                            {formatRelativeTime(cp.timestamp)}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          {cp.projectName} · Bước {cp.funnelStep} ·{' '}
                          <span className="text-slate-300">{cp.nextTaskTitle}</span>
                        </div>
                        {cp.note && (
                          <div className="text-[11px] text-slate-400 italic">
                            "{cp.note}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Export / Import Snapshot JSON */}
              <section className="space-y-3 border-t border-slate-800 pt-5">
                <div className="space-y-1">
                  <h3 className="font-display text-sm font-bold text-slate-100">
                    Xuất & Nhập Bản Chụp Dữ Liệu (Export / Import Snapshot JSON)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chuyển toàn bộ dự án, PRD, Prompt Lab và danh sách tác vụ sang hồ sơ trình duyệt hoặc máy khác.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-100 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Tải tệp JSON (Export Snapshot)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onCopyText(
                        JSON.stringify(fullSnapshot, null, 2),
                        'Snapshot JSON'
                      )
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Sao chép JSON (Copy JSON)</span>
                  </button>
                </div>

                <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      Chế độ khôi phục (Import Strategy):
                    </span>
                    <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 p-0.5">
                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                          importMode === 'merge'
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Gộp an toàn (Merge)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                          importMode === 'replace'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Thay thế toàn bộ (Replace)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      <Upload className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      <span>Chọn tệp .json để nhập (Upload JSON)</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={rawJsonInput}
                    onChange={(e) => setRawJsonInput(e.target.value)}
                    placeholder="Hoặc dán chuỗi Snapshot JSON vào đây để khôi phục..."
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!rawJsonInput.trim()}
                      onClick={() => processJsonText(rawJsonInput)}
                      className="inline-flex h-8 items-center rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      Khôi phục từ văn bản JSON (Restore JSON)
                    </button>
                  </div>

                  {importFeedback && (
                    <div
                      role="status"
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs ${
                        importFeedback.type === 'ok'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                      }`}
                    >
                      {importFeedback.type === 'ok' && (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{importFeedback.text}</span>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            /* Tab 2: AI Engines & 3rd-Party API Providers */
            <section className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">
                    Định tuyến Nguồn AI (Server-Side API Orchestration)
                  </span>
                  <button
                    type="button"
                    onClick={onRefreshServerStatus}
                    className="inline-flex h-7 items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                    <span>Kiểm tra Env</span>
                  </button>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Động cơ <strong>Gemini Built-in</strong> dùng sẵn khóa <span className="font-mono text-slate-300">GEMINI_API_KEY</span> trên máy chủ. Để dùng thêm API bên thứ 3 (OpenRouter, OpenAI, Anthropic, Groq) hoặc Ollama cục bộ, hãy khai báo endpoint và tên biến môi trường trong <strong>Settings &gt; Secrets</strong> (không lưu secret trực tiếp trên trình duyệt).
                </p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-slate-100">
                  Danh sách Nguồn Thực Thi AI (Configured Providers)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddProviderForm((v) => !v)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  <span>
                    {showAddProviderForm ? 'Đóng biểu mẫu' : 'Thêm API Bên Thứ 3'}
                  </span>
                </button>
              </div>

              {showAddProviderForm && (
                <form
                  onSubmit={handleCreateProvider}
                  className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="prov-kind"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Loại API (Provider Kind)
                      </label>
                      <select
                        id="prov-kind"
                        value={provKind}
                        onChange={(e) =>
                          handleProviderKindChange(
                            e.target.value as Exclude<
                              AiProviderKind,
                              'Google Built-in'
                            >
                          )
                        }
                        className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        {Object.keys(PRESET_3P_TEMPLATES).map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="prov-label"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Tên cấu hình (Profile Label)
                      </label>
                      <input
                        id="prov-label"
                        type="text"
                        value={provLabel}
                        onChange={(e) => setProvLabel(e.target.value)}
                        placeholder={`VD: ${provKind} Dự phòng`}
                        className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="prov-url"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Base Endpoint URL
                    </label>
                    <input
                      id="prov-url"
                      type="url"
                      value={provBaseUrl}
                      onChange={(e) => setProvBaseUrl(e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="prov-model"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Model ID
                      </label>
                      <input
                        id="prov-model"
                        type="text"
                        value={provModelId}
                        onChange={(e) => setProvModelId(e.target.value)}
                        className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="prov-env"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Tên biến Env trên Server (Env Var Name)
                      </label>
                      <input
                        id="prov-env"
                        type="text"
                        value={provEnvVar}
                        onChange={(e) => setProvEnvVar(e.target.value)}
                        placeholder="Để trống nếu dùng Ollama localhost"
                        className="h-9 w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </div>
                  </div>

                  {provError && (
                    <p className="text-xs text-rose-300">{provError}</p>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Thêm Nguồn API (Add Provider)</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/70">
                {aiProviders.map((prov) => {
                  const isActive = prov.id === activeAiProviderId;
                  const ready = checkApiReady(prov);
                  return (
                    <div
                      key={prov.id}
                      className={`flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                        isActive ? 'bg-slate-900/90' : ''
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-100">
                            {prov.label}
                          </span>
                          {ready === true && (
                            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                              Env Sẵn sàng
                            </span>
                          )}
                          {ready === false && (
                            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              Chưa set {prov.envVarName || 'Localhost'}
                            </span>
                          )}
                        </div>
                        <div className="truncate font-mono text-[11px] text-slate-400">
                          {prov.modelId} · {prov.baseUrl}
                        </div>
                        {prov.envVarName && (
                          <div className="font-mono text-[10px] text-slate-500">
                            Server Env Ref: {prov.envVarName}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isActive ? (
                          <span className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-300">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Đang chọn</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectAiProvider(prov.id)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-100 hover:border-sky-500/50 hover:bg-slate-700"
                          >
                            Kích hoạt
                          </button>
                        )}

                        {prov.apiFormat !== 'gemini-builtin' && !isActive && (
                          <button
                            type="button"
                            onClick={() => onDeleteAiProvider(prov.id)}
                            aria-label={`Xóa nguồn ${prov.label}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-500 hover:border-rose-500/40 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
};
