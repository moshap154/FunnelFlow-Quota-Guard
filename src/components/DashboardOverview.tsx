import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  FileCode2,
  Flame,
  Lock,
  Search,
  Settings2,
  Zap,
} from 'lucide-react';
import {
  AiProviderProfile,
  AiRunMetric,
  FunnelStep,
  Project,
  ProviderServerStatus,
  QuotaCycleState,
} from '../types';
import { formatCountdown, getCycleWindowInfo } from '../utils/quotaHelpers';

interface DashboardOverviewProps {
  projects: Project[];
  activeProjectId: string;
  cycleState: QuotaCycleState;
  aiProviders: AiProviderProfile[];
  activeAiProviderId: string;
  serverStatus: ProviderServerStatus | null;
  aiMetrics: AiRunMetric[];
  onSelectAiProvider: (providerId: string) => void;
  onJumpToProjectStep: (projectId: string, step: FunnelStep) => void;
  onOpenAccountProviderDrawer: () => void;
  onCopyText: (text: string, label: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  projects,
  activeProjectId,
  cycleState,
  aiProviders,
  activeAiProviderId,
  serverStatus,
  aiMetrics,
  onSelectAiProvider,
  onJumpToProjectStep,
  onOpenAccountProviderDrawer,
  onCopyText,
}) => {
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState<'pending' | 'all'>('pending');

  const windowInfo = getCycleWindowInfo(cycleState);

  const stats = useMemo(() => {
    const totalProjects = Math.max(1, projects.length);
    const s1 = projects.filter((p) => p.currentStep === 1).length;
    const s2 = projects.filter((p) => p.currentStep === 2).length;
    const s3 = projects.filter((p) => p.currentStep === 3).length;

    const allTasks = projects.flatMap((p) =>
      p.step3.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name, projectStep: p.currentStep }))
    );
    const flashCount = allTasks.filter((t) => t.modelTier === 'Flash').length;
    const proCount = allTasks.filter((t) => t.modelTier === 'Pro / Claude').length;

    return {
      totalProjects,
      s1,
      s2,
      s3,
      allTasks,
      flashCount,
      proCount,
    };
  }, [projects]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return stats.allTasks.filter((t) => {
      if (taskFilter === 'pending' && t.status === 'done') return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.targetFiles.toLowerCase().includes(q) ||
        t.projectName.toLowerCase().includes(q)
      );
    });
  }, [stats.allTasks, taskFilter, taskSearch]);

  const checkProviderReady = (prov: AiProviderProfile): boolean | null => {
    if (!serverStatus) return null;
    if (prov.apiFormat === 'gemini-builtin') return serverStatus.geminiReady;
    if (!prov.envVarName) {
      return (
        prov.baseUrl.includes('localhost') || prov.baseUrl.includes('127.0.0.1')
      );
    }
    return Boolean(serverStatus.envStatus[prov.envVarName]);
  };

  const totalTierTasks = Math.max(1, stats.flashCount + stats.proCount);

  return (
    <div className="space-y-6">
      {/* Row 1: 2-Column Balanced Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Left: Pipeline & Quota Discipline */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6 lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-display text-base font-bold text-slate-50">
                Tổng Quan Phễu & Phân Bổ Mô Hình (Pipeline & Tier Balance)
              </h2>
              <p className="text-xs text-slate-400">
                Theo dõi phân tầng dự án và tỷ lệ tác vụ Flash nhẹ so với Pro / Claude nặng trên toàn bộ workspace.
              </p>
            </div>
            <span className="font-mono text-xs text-slate-300 tabular-nums">
              {formatCountdown(cycleState.remainingMs)} · {windowInfo.title}
            </span>
          </div>

          {/* Lightweight SVG/CSS Funnel Breakdown */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">
                  Phân bổ dự án theo 3 bước (Projects by Funnel Step)
                </span>
                <span className="font-mono text-slate-400 tabular-nums">
                  B1: {stats.s1} · B2: {stats.s2} · B3: {stats.s3}
                </span>
              </div>
              <svg
                viewBox="0 0 400 14"
                className="h-3.5 w-full overflow-hidden rounded-full bg-slate-950"
                role="img"
                aria-label={`Phân bổ dự án: Bước 1 ${stats.s1}, Bước 2 ${stats.s2}, Bước 3 ${stats.s3}`}
              >
                <rect
                  x="0"
                  y="0"
                  width={(stats.s1 / stats.totalProjects) * 400}
                  height="14"
                  fill="#10b981"
                />
                <rect
                  x={(stats.s1 / stats.totalProjects) * 400}
                  y="0"
                  width={(stats.s2 / stats.totalProjects) * 400}
                  height="14"
                  fill="#0ea5e9"
                />
                <rect
                  x={((stats.s1 + stats.s2) / stats.totalProjects) * 400}
                  y="0"
                  width={(stats.s3 / stats.totalProjects) * 400}
                  height="14"
                  fill="#f43f5e"
                />
              </svg>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                <span className="text-emerald-300">Bước 1: Gemini PRD ({stats.s1})</span>
                <span className="text-sky-300">Bước 2: AI Studio ({stats.s2})</span>
                <span className="text-rose-300">Bước 3: Antigravity ({stats.s3})</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-800/80 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">
                  Tỷ lệ Tầng Mô hình Tác vụ (Flash vs Pro / Claude Ratio)
                </span>
                <span className="font-mono text-slate-400 tabular-nums">
                  Flash: {stats.flashCount} · Pro/Claude: {stats.proCount}
                </span>
              </div>
              <svg
                viewBox="0 0 400 14"
                className="h-3.5 w-full overflow-hidden rounded-full bg-slate-950"
                role="img"
                aria-label={`Tỷ lệ mô hình: Flash ${stats.flashCount}, Pro hoặc Claude ${stats.proCount}`}
              >
                <rect
                  x="0"
                  y="0"
                  width={(stats.flashCount / totalTierTasks) * 400}
                  height="14"
                  fill="#38bdf8"
                />
                <rect
                  x={(stats.flashCount / totalTierTasks) * 400}
                  y="0"
                  width={(stats.proCount / totalTierTasks) * 400}
                  height="14"
                  fill="#f59e0b"
                />
              </svg>
            </div>
          </div>

          {/* Quick Project Jump List */}
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <div className="text-xs font-semibold text-slate-300">
              Truy cập nhanh dự án (Project Quick Jump)
            </div>
            <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/70">
              {projects.map((p) => {
                const isCurrent = p.id === activeProjectId;
                const pending = p.step3.tasks.filter((t) => t.status !== 'done').length;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-slate-100">
                          {p.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold text-sky-400 shrink-0">
                            Đang chọn
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                        Bước {p.currentStep}/3 · {pending} tác vụ tồn đọng
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onJumpToProjectStep(p.id, p.currentStep)}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-sky-500/50 hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <span>Mở Phễu</span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Active AI Orchestrator & 3rd-Party API Matrix */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6 lg:col-span-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-sky-400" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-slate-50">
                  Điều Phối AI & API Bên Thứ 3 (AI Engine Matrix)
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Chọn nguồn AI thực thi cho PRD, nén Token và viết lại Scope qua máy chủ proxy an toàn.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenAccountProviderDrawer}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <Settings2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>Thêm API / TK</span>
            </button>
          </div>

          <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/70">
            {aiProviders.map((prov) => {
              const active = prov.id === activeAiProviderId;
              const ready = checkProviderReady(prov);
              return (
                <div
                  key={prov.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                    active ? 'bg-slate-900/90' : ''
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-slate-100">
                        {prov.label}
                      </span>
                      {ready === true && (
                        <span className="text-[10px] font-semibold text-emerald-400 shrink-0">
                          Sẵn sàng
                        </span>
                      )}
                      {ready === false && (
                        <span className="text-[10px] font-semibold text-amber-300 shrink-0">
                          Thiếu {prov.envVarName || 'Endpoint'}
                        </span>
                      )}
                    </div>
                    <div className="truncate font-mono text-[11px] text-slate-400">
                      {prov.modelId}
                    </div>
                  </div>

                  {active ? (
                    <span className="inline-flex h-7 items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 text-[11px] font-semibold text-emerald-300 shrink-0">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      <span>Đang dùng</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectAiProvider(prov.id)}
                      className="inline-flex h-7 items-center rounded border border-slate-700 bg-slate-900 px-2.5 text-[11px] font-semibold text-slate-200 hover:border-sky-500/50 hover:bg-slate-800 shrink-0"
                    >
                      Chọn nguồn
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Real AI Run Telemetry (Only real measured calls) */}
          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                Nhật ký Điều phối AI gần nhất (Recent API Calls)
              </span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {aiMetrics.length} lượt gọi
              </span>
            </div>

            {aiMetrics.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-400">
                Chưa có lượt gọi AI nào trong phiên này. Hãy thử nút <strong>Nén Prompt bằng AI</strong> ở Bước 2 hoặc <strong>Viết lại Scope</strong> ở Bước 3.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/60">
                {aiMetrics.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-slate-200">{m.action}</span>
                      <span className="text-slate-500"> · </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {m.modelUsed}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-300 tabular-nums shrink-0">
                      <Zap className="h-3 w-3" aria-hidden="true" />
                      <span>{m.latencyMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Row 2: High-Density Cross-Project Scoped Task Matrix */}
      <section className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-slate-50">
                Hàng Đợi Tác Vụ Khoanh Vùng Toàn Cục (Global Scoped Task Queue)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Lọc nhanh các tác vụ đang chờ across mọi dự án, sao chép prompt chuẩn Scope hoặc nhảy thẳng vào Bước 3.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Tìm tác vụ hoặc tệp..."
                aria-label="Tìm tác vụ hoặc tệp mục tiêu"
                className="h-9 w-48 rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              <button
                type="button"
                onClick={() => setTaskFilter('pending')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  taskFilter === 'pending'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Chờ xử lý
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('all')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  taskFilter === 'all'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tất cả
              </button>
            </div>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Không có tác vụ nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <th className="px-4 py-2.5 font-semibold">Tác vụ & Dự án</th>
                  <th className="px-4 py-2.5 font-semibold">Tệp mục tiêu (Target Files)</th>
                  <th className="px-4 py-2.5 font-semibold">Model Tier</th>
                  <th className="px-4 py-2.5 font-semibold">Artifact Gate</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-100">{task.title}</div>
                      <div className="text-[11px] text-slate-400">{task.projectName}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-sky-300">
                        <FileCode2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="max-w-[220px] truncate">{task.targetFiles}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${
                          task.modelTier === 'Flash'
                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {task.modelTier}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {task.reviewedDiff ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Đã duyệt Diff</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Chờ kiểm Diff</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onCopyText(task.prompt, `Prompt "${task.title}"`)
                          }
                          className="inline-flex h-7 items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                        >
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span>Copy</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToProjectStep(
                              task.projectId,
                              task.projectStep === 3 ? 3 : task.projectStep
                            )
                          }
                          className="inline-flex h-7 items-center gap-1 rounded bg-sky-600/20 px-2 text-[11px] font-semibold text-sky-300 hover:bg-sky-600/30"
                        >
                          <span>Mở</span>
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
