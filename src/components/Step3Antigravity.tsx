import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileCode2,
  Loader2,
  Lock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  AiProviderProfile,
  AiRunMetric,
  AntigravityTask,
  ModelTier,
  Project,
  TaskStatus,
} from '../types';
import { aiRewriteScope } from '../utils/aiClient';
import {
  analyzePromptLinter,
  createId,
  estimateTokens,
} from '../utils/quotaHelpers';

interface Step3AntigravityProps {
  project: Project;
  activeProvider: AiProviderProfile | undefined;
  onUpdateProject: (updater: (prev: Project) => Project) => void;
  onCopyText: (text: string, label: string) => void;
  onRecordAiMetric: (metric: AiRunMetric, toastMessage?: string) => void;
}

export const Step3Antigravity: React.FC<Step3AntigravityProps> = ({
  project,
  activeProvider,
  onUpdateProject,
  onCopyText,
  onRecordAiMetric,
}) => {
  const [title, setTitle] = useState('');
  const [targetFiles, setTargetFiles] = useState('');
  const [modelTier, setModelTier] = useState<ModelTier>('Flash');
  const [prompt, setPrompt] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [formTouched, setFormTouched] = useState(false);

  const [isRewriting, setIsRewriting] = useState(false);
  const [aiExplain, setAiExplain] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const linter = useMemo(
    () => analyzePromptLinter(targetFiles, prompt, modelTier, title),
    [targetFiles, prompt, modelTier, title]
  );

  const canCreateTask =
    title.trim().length >= 3 &&
    targetFiles.trim().length > 0 &&
    prompt.trim().length > 0;

  const handleApplyTemplate = () => {
    setPrompt(linter.suggestedTemplate);
    if (!targetFiles.trim()) {
      setTargetFiles('src/features/billing/webhook.ts');
    }
    setFormTouched(true);
  };

  const handleAiRewriteScope = async () => {
    setAiError(null);
    setAiExplain(null);
    setIsRewriting(true);
    try {
      const res = await aiRewriteScope(
        {
          taskTitle: title,
          targetFiles,
          rawPrompt: prompt,
          modelTier,
        },
        activeProvider
      );

      if (res.scopedPrompt) setPrompt(res.scopedPrompt);
      if (!targetFiles.trim() && res.suggestedTargetFiles) {
        setTargetFiles(res.suggestedTargetFiles);
      }
      if (res.recommendedTier === 'Flash' || res.recommendedTier === 'Pro / Claude') {
        setModelTier(res.recommendedTier);
      }
      setAiExplain(
        `${res.explanation} (${res.meta.modelUsed} · ${res.meta.latencyMs}ms)`
      );
      setFormTouched(true);

      onRecordAiMetric(
        {
          id: createId('met'),
          action: 'Chuẩn hóa Scope Bước 3',
          providerLabel: res.meta.providerLabel,
          modelUsed: res.meta.modelUsed,
          latencyMs: res.meta.latencyMs,
          tokensSaved: 0,
          timestamp: new Date().toISOString(),
        },
        `Đã chuẩn hóa Prompt theo Scope (${res.meta.latencyMs}ms).`
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Không thể gọi AI viết lại Prompt.'
      );
    } finally {
      setIsRewriting(false);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setFormTouched(true);
    if (!canCreateTask) return;

    const newTask: AntigravityTask = {
      id: createId('tsk'),
      title: title.trim(),
      targetFiles: targetFiles.trim(),
      modelTier,
      prompt: prompt.trim(),
      status: 'todo',
      reviewedDiff: false,
      createdAt: new Date().toISOString(),
    };

    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step3: {
        ...prev.step3,
        tasks: [newTask, ...prev.step3.tasks],
      },
    }));

    setTitle('');
    setTargetFiles('');
    setPrompt('');
    setAiExplain(null);
    setAiError(null);
    setFormTouched(false);
  };

  const handleToggleReviewedDiff = (taskId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step3: {
        ...prev.step3,
        tasks: prev.step3.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const nextReviewed = !t.reviewedDiff;
          const nextStatus =
            !nextReviewed && t.status === 'done' ? 'in_progress' : t.status;
          return { ...t, reviewedDiff: nextReviewed, status: nextStatus };
        }),
      },
    }));
  };

  const handleSetTaskStatus = (taskId: string, nextStatus: TaskStatus) => {
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step3: {
        ...prev.step3,
        tasks: prev.step3.tasks.map((t) => {
          if (t.id !== taskId) return t;
          if (nextStatus === 'done' && !t.reviewedDiff) {
            return t;
          }
          return { ...t, status: nextStatus };
        }),
      },
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step3: {
        ...prev.step3,
        tasks: prev.step3.tasks.filter((t) => t.id !== taskId),
      },
    }));
  };

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return project.step3.tasks;
    return project.step3.tasks.filter((t) => t.status === statusFilter);
  }, [project.step3.tasks, statusFilter]);

  const showLiveLinter =
    formTouched || targetFiles.length > 0 || prompt.length > 0 || title.length > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      {/* Header Band */}
      <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Bước 3: Google Antigravity — Xây dựng & Bảo vệ Hạn mức (Heavy Build & Quota Guard)
            </h2>
            <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300 whitespace-nowrap shrink-0">
              Hạn mức nghiêm ngặt · Strict Quota Mode
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Khoanh vùng chặt theo Tệp mục tiêu (Target Files), lọc prompt mơ hồ trước khi gửi và bắt buộc kiểm tra Diff trước khi đánh dấu hoàn tất.
          </p>
        </div>
      </div>

      {/* Main Split: Tightly-Scoped Task Creator + Task List with Artifact Gate */}
      <div className="grid grid-cols-1 divide-y divide-slate-800 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* Left: Tightly-Scoped Task Creator + Anti-Burnout Prompt Linter */}
        <form
          onSubmit={handleCreateTask}
          className="space-y-4 p-5 sm:p-6 lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-slate-100">
              Trình Tạo Tác Vụ Khoanh Vùng (Tightly-Scoped Task Creator)
            </h3>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              ~{estimateTokens(prompt)} tokens
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="task-title"
              className="block text-xs font-medium text-slate-300"
            >
              Tên tác vụ (Task Title)
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFormTouched(true);
              }}
              placeholder="Ví dụ: Thêm kiểm tra chữ ký Webhook (Add Webhook Signature Check)"
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="task-target-files"
              className="block text-xs font-medium text-slate-300"
            >
              Tệp mục tiêu bắt buộc (Target Files — Required)
            </label>
            <input
              id="task-target-files"
              type="text"
              value={targetFiles}
              onChange={(e) => {
                setTargetFiles(e.target.value);
                setFormTouched(true);
              }}
              placeholder="Ví dụ: src/auth.ts, src/middleware/session.ts"
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-300">
              Tầng Mô hình (Model Tier Selection)
            </span>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setModelTier('Flash')}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  modelTier === 'Flash'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                Flash (UI / CSS / Lỗi nhỏ)
              </button>
              <button
                type="button"
                onClick={() => setModelTier('Pro / Claude')}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  modelTier === 'Pro / Claude'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                Pro / Claude (Kiến trúc / DB)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="task-agent-prompt"
                className="block text-xs font-medium text-slate-300"
              >
                Câu lệnh Tác nhân (Agent Prompt)
              </label>

              <button
                type="button"
                disabled={isRewriting || (!prompt.trim() && !title.trim())}
                onClick={handleAiRewriteScope}
                className="inline-flex h-7 items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-2 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
              >
                {isRewriting ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3 w-3 text-sky-400" aria-hidden="true" />
                )}
                <span>{isRewriting ? 'Đang viết lại...' : 'Viết lại chuẩn Scope (AI)'}</span>
              </button>
            </div>
            <textarea
              id="task-agent-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setFormTouched(true);
              }}
              placeholder="[Hành động / Action] + [Tệp mục tiêu / Target File] + [Kết quả kỳ vọng / Expected Output]"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          {aiExplain && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
            >
              {aiExplain}
            </div>
          )}

          {aiError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
            >
              {aiError}
            </div>
          )}

          {/* Anti-Burnout Prompt Linter Live Banner */}
          {showLiveLinter && (
            <div
              role="status"
              className={`space-y-2.5 rounded-lg border p-3.5 text-xs ${
                linter.severity === 'error'
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                  : linter.severity === 'warning'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  {linter.severity === 'error' ? (
                    <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" aria-hidden="true" />
                  ) : linter.severity === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    Bộ kiểm tra Anti-Burnout Linter:{' '}
                    {linter.severity === 'ok'
                      ? 'Phạm vi chuẩn xác (Scoped & Safe)'
                      : linter.severity === 'error'
                        ? 'Cần khắc phục trước khi giao tác nhân (Blocked)'
                        : 'Cảnh báo dễ đốt hạn mức (Quota Burnout Risk)'}
                  </span>
                </div>
              </div>

              {linter.issues.length > 0 && (
                <ul className="list-disc pl-4 space-y-1 opacity-95">
                  {linter.issues.map((issue) => (
                    <li key={issue.id}>{issue.message}</li>
                  ))}
                </ul>
              )}

              {linter.severity !== 'ok' && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/70 pt-2.5">
                  <button
                    type="button"
                    onClick={handleApplyTemplate}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <Wand2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                    <span>Chèn mẫu chuẩn (Template)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isRewriting || (!prompt.trim() && !title.trim())}
                    onClick={handleAiRewriteScope}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-600 px-2.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Nhờ AI viết lại Scope</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!canCreateTask}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Thêm tác vụ khoanh vùng (Create Scoped Task)</span>
          </button>
        </form>

        {/* Right: Scoped Task List with Artifact Gate */}
        <div className="space-y-4 p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-display text-sm font-bold text-slate-100">
              Danh sách Tác vụ & Cổng Nghiệm Thu Diff (Task Queue & Artifact Gate)
            </h3>

            {/* Interactive Status Filter Controls */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'todo', label: 'Chờ làm' },
                  { id: 'in_progress', label: 'Đang làm' },
                  { id: 'done', label: 'Xong' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-slate-800 text-slate-50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-300">
                Chưa có tác vụ nào trong bộ lọc này (No tasks in this view).
              </p>
              <p className="text-xs text-slate-500">
                Hãy tạo tác vụ mới ở cột bên trái kèm đường dẫn Tệp mục tiêu rõ ràng để tiết kiệm hạn mức.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/70">
              {filteredTasks.map((task) => {
                const tierTone =
                  task.modelTier === 'Flash'
                    ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

                const statusLabel =
                  task.status === 'done'
                    ? 'Hoàn tất (Done)'
                    : task.status === 'in_progress'
                      ? 'Đang xử lý (In Progress)'
                      : 'Chờ làm (Todo)';

                const statusTone =
                  task.status === 'done'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : task.status === 'in_progress'
                      ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                      : 'border-slate-700 bg-slate-900 text-slate-300';

                return (
                  <div key={task.id} className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tierTone}`}
                          >
                            {task.modelTier}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${statusTone}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-slate-100">
                          {task.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onCopyText(task.prompt, `Agent Prompt "${task.title}"`)
                          }
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Sao chép Prompt (Copy)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          aria-label={`Xóa tác vụ ${task.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-400 hover:border-rose-500/40 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-slate-400">Tệp mục tiêu (Target):</span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-sky-300">
                        <FileCode2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>{task.targetFiles}</span>
                      </span>
                    </div>

                    <pre className="whitespace-pre-wrap rounded-lg border border-slate-800/90 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-300">
                      {task.prompt}
                    </pre>

                    <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-200">
                          <input
                            type="checkbox"
                            checked={task.reviewedDiff}
                            onChange={() => handleToggleReviewedDiff(task.id)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-sky-500"
                          />
                          <span>
                            Đã kiểm tra Kế hoạch & Diff (Reviewed Task Plan & Diff)
                          </span>
                        </label>
                        {!task.reviewedDiff && task.status !== 'done' && (
                          <p className="text-[11px] text-amber-300/90">
                            Cổng Artifact Gate: Cần tích kiểm tra Diff trước khi mở khóa nút "Đánh dấu Xong (Mark Done)".
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {task.status === 'todo' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSetTaskStatus(task.id, 'in_progress')
                            }
                            className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                          >
                            Bắt đầu (Start)
                          </button>
                        )}

                        {task.status === 'done' ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleSetTaskStatus(task.id, 'in_progress')
                            }
                            className="inline-flex h-8 items-center rounded-md border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                          >
                            Mở lại (Reopen)
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!task.reviewedDiff}
                            onClick={() => handleSetTaskStatus(task.id, 'done')}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 whitespace-nowrap"
                          >
                            {task.reviewedDiff ? (
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            <span>Đánh dấu Xong (Mark Done)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
