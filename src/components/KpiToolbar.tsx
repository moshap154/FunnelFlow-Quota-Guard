import React from 'react';
import {
  Cpu,
  Layers,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import {
  AiProviderProfile,
  AiRunMetric,
  Project,
  ProviderServerStatus,
} from '../types';
import { estimateTokens } from '../utils/quotaHelpers';

export type WorkspaceView = 'overview' | 'funnel';

interface KpiToolbarProps {
  viewMode: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  projects: Project[];
  activeProvider: AiProviderProfile | undefined;
  serverStatus: ProviderServerStatus | null;
  aiMetrics: AiRunMetric[];
  onOpenAiProviders: () => void;
}

export const KpiToolbar: React.FC<KpiToolbarProps> = ({
  viewMode,
  onChangeView,
  projects,
  activeProvider,
  serverStatus,
  aiMetrics,
  onOpenAiProviders,
}) => {
  const stepCounts = {
    s1: projects.filter((p) => p.currentStep === 1).length,
    s2: projects.filter((p) => p.currentStep === 2).length,
    s3: projects.filter((p) => p.currentStep === 3).length,
  };

  const allTasks = projects.flatMap((p) => p.step3.tasks);
  const doneTasks = allTasks.filter((t) => t.status === 'done').length;
  const pendingTasks = allTasks.length - doneTasks;
  const reviewedCount = allTasks.filter((t) => t.reviewedDiff).length;
  const diffCompliance =
    allTasks.length > 0 ? Math.round((reviewedCount / allTasks.length) * 100) : 100;

  // Real token savings across Prompt Lab variants + AI Compressor runs
  const labTokensSaved = projects.reduce((acc, p) => {
    const nonEmpty = p.step2.prompts.filter((pr) => pr.content.trim().length > 0);
    if (nonEmpty.length < 2) return acc;
    const maxTokens = Math.max(...nonEmpty.map((pr) => estimateTokens(pr.content)));
    const prod = nonEmpty.find((pr) => pr.isProduction) ?? nonEmpty[0];
    const prodTokens = estimateTokens(prod.content);
    return acc + Math.max(0, maxTokens - prodTokens);
  }, 0);

  const aiSaved = aiMetrics.reduce((sum, m) => sum + (m.tokensSaved || 0), 0);
  const totalTokensSaved = labTokensSaved + aiSaved;

  const lastRun = aiMetrics[0];

  const isProviderReady = (() => {
    if (!activeProvider || !serverStatus) return null;
    if (activeProvider.apiFormat === 'gemini-builtin') {
      return serverStatus.geminiReady;
    }
    if (!activeProvider.envVarName) {
      return activeProvider.baseUrl.includes('localhost') || activeProvider.baseUrl.includes('127.0.0.1');
    }
    return Boolean(serverStatus.envStatus[activeProvider.envVarName]);
  })();

  return (
    <section aria-label="Chỉ số tổng quan và điều hướng chế độ" className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 lg:flex-row lg:items-stretch lg:justify-between">
        {/* 4 Compact KPI Cells */}
        <div className="grid flex-1 grid-cols-2 divide-y divide-slate-800 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {/* KPI 1 */}
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Layers className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
              <span className="truncate">Phễu dự án (Funnel)</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg font-bold text-slate-50 tabular-nums">
                {projects.length}
              </span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                B1:{stepCounts.s1} · B2:{stepCounts.s2} · B3:{stepCounts.s3}
              </span>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="truncate">Tác vụ & Diff Gate</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg font-bold text-slate-50 tabular-nums">
                {pendingTasks} chờ
              </span>
              <span className="font-mono text-[11px] text-emerald-400 tabular-nums">
                {diffCompliance}% Diff OK
              </span>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="truncate">Token đã tiết kiệm</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-lg font-bold text-slate-50 tabular-nums">
                ~{totalTokensSaved}
              </span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                tokens
              </span>
            </div>
          </div>

          {/* KPI 4: Active AI Engine */}
          <button
            type="button"
            onClick={onOpenAiProviders}
            className="px-4 py-3 space-y-1 text-left hover:bg-slate-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <div className="flex items-center justify-between gap-1.5 text-[11px] font-medium text-slate-400">
              <span className="inline-flex items-center gap-1.5 truncate">
                <Cpu className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                <span className="truncate">Động cơ AI (Engine)</span>
              </span>
              {isProviderReady === true ? (
                <span className="text-[10px] font-semibold text-emerald-400 shrink-0">
                  Sẵn sàng
                </span>
              ) : isProviderReady === false ? (
                <span className="text-[10px] font-semibold text-amber-300 shrink-0">
                  Thiếu Env
                </span>
              ) : null}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-slate-100">
                {activeProvider?.label ?? 'Gemini Built-in'}
              </span>
              {lastRun && (
                <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                  {lastRun.latencyMs}ms
                </span>
              )}
            </div>
          </button>
        </div>

        {/* View Switcher: Overview Dashboard | Funnel Workspace */}
        <div className="flex items-center justify-end border-t border-slate-800 px-3 py-2.5 lg:border-l lg:border-t-0">
          <div className="flex w-full items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1 lg:w-auto">
            <button
              type="button"
              onClick={() => onChangeView('overview')}
              className={`inline-flex flex-1 lg:flex-initial items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                viewMode === 'overview'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tổng quan (Dashboard)</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeView('funnel')}
              className={`inline-flex flex-1 lg:flex-initial items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                viewMode === 'funnel'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Không gian Phễu (Funnel)</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
