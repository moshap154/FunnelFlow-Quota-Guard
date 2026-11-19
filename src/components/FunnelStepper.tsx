import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Lock,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { FunnelStep, Project, QuotaCycleState } from '../types';
import { getCycleWindowInfo } from '../utils/quotaHelpers';

interface FunnelStepperProps {
  project: Project;
  cycleState: QuotaCycleState;
  onSelectStep: (step: FunnelStep) => void;
  gateNotice: string | null;
}

export const FunnelStepper: React.FC<FunnelStepperProps> = ({
  project,
  cycleState,
  onSelectStep,
  gateNotice,
}) => {
  const windowInfo = getCycleWindowInfo(cycleState);

  const windowBadgeStyle =
    windowInfo.mode === 'peak'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : windowInfo.mode === 'low'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : windowInfo.mode === 'expired'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          : 'border-slate-700 bg-slate-900 text-slate-300';

  const WindowIcon =
    windowInfo.mode === 'peak'
      ? Flame
      : windowInfo.mode === 'low' || windowInfo.mode === 'expired'
        ? AlertTriangle
        : Clock;

  const steps: {
    step: FunnelStep;
    title: string;
    tool: string;
    badge: string;
    badgeTone: string;
    icon: React.ComponentType<{ className?: string }>;
    unlocked: boolean;
    completed: boolean;
  }[] = [
    {
      step: 1,
      title: 'Bước 1: Lên ý tưởng & PRD (Ideation & PRD)',
      tool: 'Gemini App',
      badge: 'Zero Dev Quota',
      badgeTone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      icon: Sparkles,
      unlocked: true,
      completed: project.step1.isLocked,
    },
    {
      step: 2,
      title: 'Bước 2: Nguyên mẫu & Lab Prompt (Prototype & Prompt Lab)',
      tool: 'Google AI Studio',
      badge: 'Free Tier Validation',
      badgeTone: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
      icon: Wrench,
      unlocked: project.step1.isLocked,
      completed: project.step2.isConfirmed,
    },
    {
      step: 3,
      title: 'Bước 3: Xây dựng chuyên sâu (Heavy Build & Quota Guard)',
      tool: 'Google Antigravity',
      badge: 'Strict Quota Mode',
      badgeTone: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      icon: Cpu,
      unlocked: project.step1.isLocked && project.step2.isConfirmed,
      completed:
        project.step3.tasks.length > 0 &&
        project.step3.tasks.every((t) => t.status === 'done'),
    },
  ];

  return (
    <section className="space-y-4">
      {/* Project Title + Smart Quota Window Indicator */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Dự án đang mở (Active Project)</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Bước {project.currentStep}/3
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {project.step3.tasks.filter((t) => t.status === 'done').length}/
              {project.step3.tasks.length} tác vụ hoàn tất
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-50">
            {project.name}
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            {project.summary}
          </p>
        </div>

        {/* Smart 5-Hour Window Indicator */}
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 lg:max-w-md shrink-0 ${windowBadgeStyle}`}
        >
          <WindowIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-0.5 text-xs">
            <div className="font-semibold">{windowInfo.title}</div>
            <p className="opacity-90 leading-relaxed">{windowInfo.guidance}</p>
          </div>
        </div>
      </div>

      {/* 3-Step Funnel Selector */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((item) => {
          const isActive = project.currentStep === item.step;
          const Icon = item.icon;

          return (
            <button
              key={item.step}
              type="button"
              onClick={() => onSelectStep(item.step)}
              className={`group flex flex-col justify-between gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isActive
                  ? 'border-sky-500/60 bg-slate-900'
                  : item.unlocked
                    ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
                    : 'border-slate-800/70 bg-slate-950 text-slate-500 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-300">
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <span>{item.tool}</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${item.badgeTone}`}
                >
                  {item.badge}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 w-full">
                <span
                  className={`font-display text-sm font-semibold ${
                    isActive ? 'text-slate-50' : item.unlocked ? 'text-slate-200' : 'text-slate-400'
                  }`}
                >
                  {item.title}
                </span>

                {item.completed ? (
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-400 shrink-0"
                    aria-label="Đã hoàn thành bước (Completed)"
                  />
                ) : !item.unlocked ? (
                  <Lock
                    className="h-4 w-4 text-slate-500 shrink-0"
                    aria-label="Đang khóa cổng kiểm soát (Gate Locked)"
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inline Gate Blocker Notice if user clicks a locked step */}
      {gateNotice && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <Lock className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span>{gateNotice}</span>
        </div>
      )}
    </section>
  );
};
