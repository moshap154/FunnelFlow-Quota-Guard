import React from 'react';
import {
  FolderKanban,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AccountProfile, Project, QuotaCycleState } from '../types';
import { formatCountdown, getCycleWindowInfo } from '../utils/quotaHelpers';

interface TopBarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  cycleState: QuotaCycleState;
  onStartCycle: () => void;
  onPauseCycle: () => void;
  onResetCycle: () => void;
  activeAccount: AccountProfile | undefined;
  accountCount: number;
  onOpenAccountDrawer: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenNewProject,
  cycleState,
  onStartCycle,
  onPauseCycle,
  onResetCycle,
  activeAccount,
  accountCount,
  onOpenAccountDrawer,
}) => {
  const windowInfo = getCycleWindowInfo(cycleState);

  const timerTone =
    windowInfo.mode === 'peak'
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
      : windowInfo.mode === 'low'
        ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
        : windowInfo.mode === 'expired'
          ? 'text-rose-300 border-rose-500/30 bg-rose-500/10'
          : 'text-slate-200 border-slate-700 bg-slate-800/70';

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm lg:sticky lg:top-0 lg:z-30">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="font-display text-base font-bold tracking-tight text-slate-50">
              FunnelFlow Quota Guard
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenAccountDrawer}
            className="inline-flex lg:hidden items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap shrink-0"
          >
            <Users className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <span className="max-w-[120px] truncate">
              {activeAccount ? activeAccount.label : 'Tài khoản'}
            </span>
          </button>
        </div>

        {/* Zone 2: Project Switcher + New Project + 5h Cycle Timer */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex flex-1 sm:flex-initial items-center gap-2 min-w-[200px]">
            <label htmlFor="project-switcher" className="sr-only">
              Chọn dự án (Project Switcher)
            </label>
            <div className="relative flex-1 sm:w-64">
              <FolderKanban
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <select
                id="project-switcher"
                value={activeProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
                className="h-10 w-full appearance-none rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-8 text-sm font-medium text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 truncate"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onOpenNewProject}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-100 hover:border-slate-600 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <span>+ Dự án mới (New Project)</span>
            </button>
          </div>

          {/* Interactive 5-Hour Antigravity Session Timer */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5">
            <span
              className={`rounded-md border px-2 py-0.5 font-mono text-sm font-semibold tabular-nums whitespace-nowrap shrink-0 ${timerTone}`}
              title="Đồng hồ chu kỳ 5 giờ Antigravity (5-Hour Quota Cycle)"
            >
              {formatCountdown(cycleState.remainingMs)}
            </span>

            {cycleState.status === 'running' ? (
              <button
                type="button"
                onClick={onPauseCycle}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-slate-800 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap shrink-0"
              >
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tạm dừng (Pause)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartCycle}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {cycleState.status === 'paused'
                    ? 'Tiếp tục 5h (Resume)'
                    : 'Bắt đầu Chu kỳ 5h (Start 5h Heavy Cycle)'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onResetCycle}
              title="Đặt lại đồng hồ 05:00:00 (Reset)"
              aria-label="Đặt lại đồng hồ 5 giờ (Reset Timer)"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Zone 3: Desktop Account & Handoff Drawer Trigger */}
        <div className="hidden lg:flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenAccountDrawer}
            className="inline-flex h-10 items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 text-sm font-medium text-slate-100 hover:border-sky-500/50 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap shrink-0"
          >
            <Users className="h-4 w-4 text-sky-400 shrink-0" aria-hidden="true" />
            <span className="max-w-[170px] truncate">
              {activeAccount ? activeAccount.label : 'Chọn tài khoản'}
            </span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {accountCount} TK
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
