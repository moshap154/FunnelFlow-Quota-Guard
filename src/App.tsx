import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { AccountHandoffDrawer } from './components/AccountHandoffDrawer';
import { DashboardOverview } from './components/DashboardOverview';
import { FunnelStepper } from './components/FunnelStepper';
import { KpiToolbar, WorkspaceView } from './components/KpiToolbar';
import { NewProjectModal } from './components/NewProjectModal';
import { Step1Ideation } from './components/Step1Ideation';
import { Step2PromptLab } from './components/Step2PromptLab';
import { Step3Antigravity } from './components/Step3Antigravity';
import { TopBar } from './components/TopBar';
import { SEED_DATA } from './data/seedData';
import {
  AccountProfile,
  AccountProvider,
  AiProviderProfile,
  AiRunMetric,
  AppSnapshot,
  FunnelStep,
  HandoffCheckpoint,
  Project,
  ProviderServerStatus,
  QuotaMode,
} from './types';
import { fetchProviderStatus } from './utils/aiClient';
import {
  createId,
  evaluateStep1Gate,
  evaluateStep2Gate,
  FIVE_HOURS_MS,
  validateSnapshot,
} from './utils/quotaHelpers';

const STORAGE_KEY = 'funnelflow_quota_guard_v1';

function loadInitialState(): AppSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_DATA;
    const parsed = JSON.parse(raw);
    const validated = validateSnapshot(parsed);
    if (!validated) return SEED_DATA;

    if (
      validated.cycleState.status === 'running' &&
      validated.cycleState.endTimestamp
    ) {
      const remaining = validated.cycleState.endTimestamp - Date.now();
      if (remaining <= 0) {
        validated.cycleState = {
          ...validated.cycleState,
          status: 'expired',
          remainingMs: 0,
          endTimestamp: null,
        };
      } else {
        validated.cycleState = {
          ...validated.cycleState,
          remainingMs: remaining,
        };
      }
    }

    return validated;
  } catch {
    return SEED_DATA;
  }
}

export default function App() {
  const [state, setState] = useState<AppSnapshot>(() => loadInitialState());
  const [viewMode, setViewMode] = useState<WorkspaceView>('overview');
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<
    'accounts' | 'providers'
  >('accounts');
  const [serverStatus, setServerStatus] = useState<ProviderServerStatus | null>(
    null
  );
  const [gateNotice, setGateNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmResetSeed, setConfirmResetSeed] = useState(false);

  // Persist every state change to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, exportedAt: new Date().toISOString() })
      );
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [state]);

  // Check server-side Gemini & 3rd-party env readiness
  const refreshServerStatus = useCallback(async () => {
    try {
      const envVars = state.aiProviders
        .map((p) => p.envVarName)
        .filter((v) => v && v.trim().length > 0);
      const status = await fetchProviderStatus(envVars);
      setServerStatus(status);
    } catch {
      // Non-fatal if offline
    }
  }, [state.aiProviders]);

  useEffect(() => {
    refreshServerStatus();
  }, [refreshServerStatus]);

  // 1-second timer tick while 5-hour cycle is running
  useEffect(() => {
    if (state.cycleState.status !== 'running' || !state.cycleState.endTimestamp) {
      return;
    }

    const tick = () => {
      setState((prev) => {
        if (
          prev.cycleState.status !== 'running' ||
          !prev.cycleState.endTimestamp
        ) {
          return prev;
        }
        const remaining = prev.cycleState.endTimestamp - Date.now();
        if (remaining <= 0) {
          return {
            ...prev,
            cycleState: {
              ...prev.cycleState,
              status: 'expired',
              remainingMs: 0,
              endTimestamp: null,
            },
          };
        }
        return {
          ...prev,
          cycleState: {
            ...prev.cycleState,
            remainingMs: remaining,
          },
        };
      });
    };

    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [state.cycleState.status, state.cycleState.endTimestamp]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 3000);
  }, []);

  const handleCopyText = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(`Đã sao chép ${label} vào bảng nhớ tạm (Copied to clipboard).`);
      } catch {
        showToast(`Không thể tự động sao chép ${label} — vui lòng chọn thủ công.`);
      }
    },
    [showToast]
  );

  const activeProject = useMemo(
    () =>
      state.projects.find((p) => p.id === state.activeProjectId) ??
      state.projects[0],
    [state.projects, state.activeProjectId]
  );

  const activeAccount = useMemo(
    () =>
      state.accounts.find((a) => a.id === state.activeAccountId) ??
      state.accounts[0],
    [state.accounts, state.activeAccountId]
  );

  const activeAiProvider = useMemo(
    () =>
      state.aiProviders.find((p) => p.id === state.activeAiProviderId) ??
      state.aiProviders[0],
    [state.aiProviders, state.activeAiProviderId]
  );

  const updateActiveProject = useCallback(
    (updater: (prev: Project) => Project) => {
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === prev.activeProjectId ? updater(p) : p
        ),
      }));
    },
    []
  );

  const handleRecordAiMetric = useCallback(
    (metric: AiRunMetric, toastMessage?: string) => {
      setState((prev) => ({
        ...prev,
        aiMetrics: [metric, ...prev.aiMetrics].slice(0, 20),
      }));
      if (toastMessage) showToast(toastMessage);
    },
    [showToast]
  );

  // Funnel Navigation with Strict Gate Enforcement
  const handleSelectStep = (targetStep: FunnelStep) => {
    if (!activeProject) return;
    setGateNotice(null);

    if (targetStep === 1) {
      updateActiveProject((p) => ({ ...p, currentStep: 1 }));
      return;
    }

    if (targetStep === 2) {
      if (!activeProject.step1.isLocked) {
        const check = evaluateStep1Gate(activeProject);
        setGateNotice(
          check.allowed
            ? 'Cần bấm "Khóa PRD & Sang Bước 2" trước khi chuyển sang Google AI Studio.'
            : `Chưa thể mở Bước 2 (Strict Gate): ${check.blockers[0]}`
        );
        return;
      }
      updateActiveProject((p) => ({ ...p, currentStep: 2 }));
      return;
    }

    if (targetStep === 3) {
      if (!activeProject.step1.isLocked) {
        setGateNotice(
          'Chưa thể mở Bước 3 (Strict Gate): Hãy hoàn thành và khóa PRD ở Bước 1 trước.'
        );
        return;
      }
      if (!activeProject.step2.isConfirmed) {
        const check2 = evaluateStep2Gate(activeProject);
        setGateNotice(
          check2.allowed
            ? 'Cần bấm "Xác nhận Prototype & Sang Bước 3" để mở Google Antigravity.'
            : `Chưa thể mở Bước 3 (Strict Gate): ${check2.blockers[0]}`
        );
        return;
      }
      updateActiveProject((p) => ({ ...p, currentStep: 3 }));
    }
  };

  const handleAdvanceToStep2 = () => {
    if (!activeProject) return;
    const gate = evaluateStep1Gate(activeProject);
    if (!gate.allowed) return;
    setGateNotice(null);
    updateActiveProject((prev) => ({
      ...prev,
      currentStep: 2,
      updatedAt: new Date().toISOString(),
      step1: {
        ...prev.step1,
        isLocked: true,
        lockedAt: prev.step1.lockedAt ?? new Date().toISOString(),
      },
    }));
    showToast('Đã khóa PRD và chuyển sang Bước 2 — Google AI Studio.');
  };

  const handleAdvanceToStep3 = () => {
    if (!activeProject) return;
    const gate = evaluateStep2Gate(activeProject);
    if (!gate.allowed) return;
    setGateNotice(null);
    updateActiveProject((prev) => ({
      ...prev,
      currentStep: 3,
      updatedAt: new Date().toISOString(),
      step2: {
        ...prev.step2,
        isConfirmed: true,
        confirmedAt: prev.step2.confirmedAt ?? new Date().toISOString(),
      },
    }));
    showToast('Đã xác nhận Prototype và mở Bước 3 — Google Antigravity.');
  };

  const handleCreateProjectDirect = (newProj: Project, metric?: AiRunMetric) => {
    setGateNotice(null);
    setViewMode('funnel');
    setState((prev) => ({
      ...prev,
      projects: [newProj, ...prev.projects],
      activeProjectId: newProj.id,
      aiMetrics: metric ? [metric, ...prev.aiMetrics].slice(0, 20) : prev.aiMetrics,
    }));
    showToast(
      metric
        ? `AI đã sinh dự án "${newProj.name}" (${metric.modelUsed} · ${metric.latencyMs}ms).`
        : `Đã khởi tạo dự án "${newProj.name}" kèm khung Bước 1–3.`
    );
  };

  // 5-Hour Cycle Timer Controls
  const handleStartCycle = () => {
    setState((prev) => {
      const baseRemaining =
        prev.cycleState.status === 'paused' && prev.cycleState.remainingMs > 0
          ? prev.cycleState.remainingMs
          : FIVE_HOURS_MS;
      return {
        ...prev,
        cycleState: {
          status: 'running',
          durationMs: FIVE_HOURS_MS,
          remainingMs: baseRemaining,
          endTimestamp: Date.now() + baseRemaining,
        },
      };
    });
  };

  const handlePauseCycle = () => {
    setState((prev) => {
      const remaining = prev.cycleState.endTimestamp
        ? Math.max(0, prev.cycleState.endTimestamp - Date.now())
        : prev.cycleState.remainingMs;
      return {
        ...prev,
        cycleState: {
          ...prev.cycleState,
          status: 'paused',
          remainingMs: remaining,
          endTimestamp: null,
        },
      };
    });
  };

  const handleResetCycle = () => {
    setState((prev) => ({
      ...prev,
      cycleState: {
        status: 'idle',
        durationMs: FIVE_HOURS_MS,
        remainingMs: FIVE_HOURS_MS,
        endTimestamp: null,
      },
    }));
    showToast('Đã đặt lại đồng hồ chu kỳ 5 giờ về 05:00:00.');
  };

  // Multi-Account & Handoff Checkpoints
  const createCheckpointEntry = (
    fromAcc: AccountProfile | undefined,
    toAcc: AccountProfile | undefined,
    proj: Project | undefined
  ): HandoffCheckpoint => {
    const nextTask = proj?.step3.tasks.find((t) => t.status !== 'done');
    return {
      id: createId('cp'),
      timestamp: new Date().toISOString(),
      fromAccountLabel: fromAcc?.label ?? 'Không rõ',
      toAccountLabel: toAcc?.label ?? 'Không rõ',
      projectId: proj?.id ?? '',
      projectName: proj?.name ?? 'Dự án hiện tại',
      funnelStep: proj?.currentStep ?? 1,
      nextTaskTitle: nextTask?.title ?? 'Chưa có tác vụ tồn đọng',
      note: fromAcc?.sessionNote?.trim() ?? '',
    };
  };

  const handleSwitchAccount = (targetId: string) => {
    if (targetId === state.activeAccountId) return;
    const now = new Date().toISOString();
    setState((prev) => {
      const fromAcc = prev.accounts.find((a) => a.id === prev.activeAccountId);
      const toAcc = prev.accounts.find((a) => a.id === targetId);
      const proj = prev.projects.find((p) => p.id === prev.activeProjectId);
      const checkpoint = createCheckpointEntry(fromAcc, toAcc, proj);

      return {
        ...prev,
        activeAccountId: targetId,
        accounts: prev.accounts.map((a) =>
          a.id === targetId ? { ...a, lastActiveAt: now } : a
        ),
        checkpoints: [checkpoint, ...prev.checkpoints].slice(0, 20),
      };
    });
    const targetAcc = state.accounts.find((a) => a.id === targetId);
    if (targetAcc) {
      showToast(
        `Đã chuyển sang "${targetAcc.label}" và tự động ghi mốc bàn giao.`
      );
    }
  };

  const handleAddAccount = (payload: {
    label: string;
    emailOrHandle: string;
    provider: AccountProvider;
    quotaMode: QuotaMode;
    sessionNote: string;
  }) => {
    const newAcc: AccountProfile = {
      id: createId('acc'),
      label: payload.label,
      emailOrHandle: payload.emailOrHandle,
      provider: payload.provider,
      quotaMode: payload.quotaMode,
      lastActiveAt: new Date().toISOString(),
      sessionNote: payload.sessionNote,
    };
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAcc],
    }));
    showToast(`Đã thêm hồ sơ tài khoản "${newAcc.label}".`);
  };

  const handleUpdateAccountNote = (accountId: string, note: string) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === accountId ? { ...a, sessionNote: note } : a
      ),
    }));
  };

  const handleDeleteAccount = (accountId: string) => {
    setState((prev) => {
      if (prev.accounts.length <= 1 || accountId === prev.activeAccountId) {
        return prev;
      }
      return {
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== accountId),
      };
    });
  };

  const handleRecordManualCheckpoint = () => {
    setState((prev) => {
      const acc = prev.accounts.find((a) => a.id === prev.activeAccountId);
      const proj = prev.projects.find((p) => p.id === prev.activeProjectId);
      const checkpoint = createCheckpointEntry(acc, acc, proj);
      return {
        ...prev,
        checkpoints: [checkpoint, ...prev.checkpoints].slice(0, 20),
      };
    });
    showToast('Đã ghi nhận Mốc Bàn Giao (Handoff Checkpoint logged).');
  };

  // AI Provider Routing Handlers
  const handleSelectAiProvider = (providerId: string) => {
    setState((prev) => ({ ...prev, activeAiProviderId: providerId }));
    const prov = state.aiProviders.find((p) => p.id === providerId);
    if (prov) {
      showToast(`Đã chuyển động cơ AI sang "${prov.label}".`);
    }
  };

  const handleAddAiProvider = (payload: Omit<AiProviderProfile, 'id'>) => {
    const created: AiProviderProfile = {
      ...payload,
      id: createId('prov'),
    };
    setState((prev) => ({
      ...prev,
      aiProviders: [...prev.aiProviders, created],
      activeAiProviderId: created.id,
    }));
    showToast(`Đã thêm và kích hoạt nguồn AI "${created.label}".`);
  };

  const handleDeleteAiProvider = (providerId: string) => {
    setState((prev) => {
      const target = prev.aiProviders.find((p) => p.id === providerId);
      if (
        !target ||
        target.apiFormat === 'gemini-builtin' ||
        providerId === prev.activeAiProviderId
      ) {
        return prev;
      }
      return {
        ...prev,
        aiProviders: prev.aiProviders.filter((p) => p.id !== providerId),
      };
    });
  };

  const handleImportSnapshot = (
    incoming: AppSnapshot,
    mode: 'merge' | 'replace'
  ) => {
    if (mode === 'replace') {
      setState(incoming);
      showToast('Đã thay thế toàn bộ dữ liệu từ bản chụp JSON.');
      return;
    }

    setState((prev) => {
      const existingProjIds = new Set(prev.projects.map((p) => p.id));
      const mergedProjects = [
        ...prev.projects,
        ...incoming.projects.filter((p) => !existingProjIds.has(p.id)),
      ];

      const existingAccIds = new Set(prev.accounts.map((a) => a.id));
      const mergedAccounts = [
        ...prev.accounts,
        ...incoming.accounts.filter((a) => !existingAccIds.has(a.id)),
      ];

      const existingProvIds = new Set(prev.aiProviders.map((p) => p.id));
      const mergedProviders = [
        ...prev.aiProviders,
        ...incoming.aiProviders.filter((p) => !existingProvIds.has(p.id)),
      ];

      const existingCpIds = new Set(prev.checkpoints.map((c) => c.id));
      const mergedCheckpoints = [
        ...prev.checkpoints,
        ...incoming.checkpoints.filter((c) => !existingCpIds.has(c.id)),
      ].slice(0, 20);

      return {
        ...prev,
        projects: mergedProjects,
        accounts: mergedAccounts,
        aiProviders: mergedProviders,
        checkpoints: mergedCheckpoints,
      };
    });
    showToast('Đã gộp an toàn dữ liệu mới vào không gian làm việc.');
  };

  const handleResetDemoData = () => {
    setState(SEED_DATA);
    setConfirmResetSeed(false);
    setGateNotice(null);
    showToast('Đã khôi phục dữ liệu mẫu ban đầu (Reset to sample data).');
  };

  const handleJumpToProjectStep = (projectId: string, step: FunnelStep) => {
    setGateNotice(null);
    setState((prev) => ({
      ...prev,
      activeProjectId: projectId,
      projects: prev.projects.map((p) =>
        p.id === projectId ? { ...p, currentStep: step } : p
      ),
    }));
    setViewMode('funnel');
  };

  const openDrawerTab = (tab: 'accounts' | 'providers') => {
    setDrawerInitialTab(tab);
    setIsAccountDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <TopBar
        projects={state.projects}
        activeProjectId={activeProject?.id ?? ''}
        onSelectProject={(id) => {
          setGateNotice(null);
          setState((prev) => ({ ...prev, activeProjectId: id }));
        }}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        cycleState={state.cycleState}
        onStartCycle={handleStartCycle}
        onPauseCycle={handlePauseCycle}
        onResetCycle={handleResetCycle}
        activeAccount={activeAccount}
        accountCount={state.accounts.length}
        onOpenAccountDrawer={() => openDrawerTab('accounts')}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-4 py-5 sm:px-6">
        <KpiToolbar
          viewMode={viewMode}
          onChangeView={setViewMode}
          projects={state.projects}
          activeProvider={activeAiProvider}
          serverStatus={serverStatus}
          aiMetrics={state.aiMetrics}
          onOpenAiProviders={() => openDrawerTab('providers')}
        />

        {viewMode === 'overview' ? (
          <DashboardOverview
            projects={state.projects}
            activeProjectId={activeProject?.id ?? ''}
            cycleState={state.cycleState}
            aiProviders={state.aiProviders}
            activeAiProviderId={state.activeAiProviderId}
            serverStatus={serverStatus}
            aiMetrics={state.aiMetrics}
            onSelectAiProvider={handleSelectAiProvider}
            onJumpToProjectStep={handleJumpToProjectStep}
            onOpenAccountProviderDrawer={() => openDrawerTab('providers')}
            onCopyText={handleCopyText}
          />
        ) : (
          activeProject && (
            <>
              <FunnelStepper
                project={activeProject}
                cycleState={state.cycleState}
                onSelectStep={handleSelectStep}
                gateNotice={gateNotice}
              />

              {activeProject.currentStep === 1 && (
                <Step1Ideation
                  project={activeProject}
                  activeProvider={activeAiProvider}
                  onUpdateProject={updateActiveProject}
                  onAdvanceToStep2={handleAdvanceToStep2}
                  onRecordAiMetric={handleRecordAiMetric}
                />
              )}

              {activeProject.currentStep === 2 && (
                <Step2PromptLab
                  project={activeProject}
                  activeProvider={activeAiProvider}
                  onUpdateProject={updateActiveProject}
                  onAdvanceToStep3={handleAdvanceToStep3}
                  onCopyText={handleCopyText}
                  onRecordAiMetric={handleRecordAiMetric}
                />
              )}

              {activeProject.currentStep === 3 && (
                <Step3Antigravity
                  project={activeProject}
                  activeProvider={activeAiProvider}
                  onUpdateProject={updateActiveProject}
                  onCopyText={handleCopyText}
                  onRecordAiMetric={handleRecordAiMetric}
                />
              )}
            </>
          )
        )}
      </main>

      {/* Quiet Utility Footer with Safe Demo Reset */}
      <footer className="border-t border-slate-900 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            FunnelFlow Quota Guard · Lưu trữ cục bộ & Điều phối AI Server Proxy
          </span>

          <div className="flex items-center gap-2">
            {confirmResetSeed ? (
              <>
                <span className="text-amber-300">Khôi phục lại dữ liệu mẫu?</span>
                <button
                  type="button"
                  onClick={handleResetDemoData}
                  className="rounded border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-medium text-rose-200 hover:bg-rose-500/25"
                >
                  Xác nhận (Confirm)
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetSeed(false)}
                  className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetSeed(true)}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Đặt lại dữ liệu mẫu (Reset Demo Data)</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-2 rounded-lg border border-emerald-500/40 bg-slate-900 px-4 py-3 text-xs font-medium text-emerald-200 shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}

      {/* Modals & Drawers */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        activeProvider={activeAiProvider}
        onCreateProjectDirect={handleCreateProjectDirect}
      />

      <AccountHandoffDrawer
        isOpen={isAccountDrawerOpen}
        initialTab={drawerInitialTab}
        onClose={() => setIsAccountDrawerOpen(false)}
        accounts={state.accounts}
        activeAccountId={state.activeAccountId}
        onSwitchAccount={handleSwitchAccount}
        onAddAccount={handleAddAccount}
        onUpdateAccountNote={handleUpdateAccountNote}
        onDeleteAccount={handleDeleteAccount}
        activeProject={activeProject}
        cycleState={state.cycleState}
        checkpoints={state.checkpoints}
        onRecordManualCheckpoint={handleRecordManualCheckpoint}
        onCopyText={handleCopyText}
        fullSnapshot={state}
        onImportSnapshot={handleImportSnapshot}
        aiProviders={state.aiProviders}
        activeAiProviderId={state.activeAiProviderId}
        serverStatus={serverStatus}
        onRefreshServerStatus={refreshServerStatus}
        onSelectAiProvider={handleSelectAiProvider}
        onAddAiProvider={handleAddAiProvider}
        onDeleteAiProvider={handleDeleteAiProvider}
        onRecordAiMetric={handleRecordAiMetric}
      />
    </div>
  );
}
