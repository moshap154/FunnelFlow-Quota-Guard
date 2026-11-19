import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  ListChecks,
  Loader2,
  Lock,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react';
import { AiProviderProfile, AiRunMetric, Project } from '../types';
import { aiStep1Assist } from '../utils/aiClient';
import {
  createId,
  evaluateStep1Gate,
  formatRelativeTime,
} from '../utils/quotaHelpers';

interface Step1IdeationProps {
  project: Project;
  activeProvider: AiProviderProfile | undefined;
  onUpdateProject: (updater: (prev: Project) => Project) => void;
  onAdvanceToStep2: () => void;
  onRecordAiMetric: (metric: AiRunMetric, toastMessage?: string) => void;
}

export const Step1Ideation: React.FC<Step1IdeationProps> = ({
  project,
  activeProvider,
  onUpdateProject,
  onAdvanceToStep2,
  onRecordAiMetric,
}) => {
  const [newCheckItem, setNewCheckItem] = useState('');
  const [isAssisting, setIsAssisting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { step1 } = project;
  const gate = evaluateStep1Gate(project);

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCheckItem.trim();
    if (!label || step1.isLocked) return;
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step1: {
        ...prev.step1,
        checklist: [
          ...prev.step1.checklist,
          { id: createId('chk'), label, checked: false },
        ],
      },
    }));
    setNewCheckItem('');
  };

  const handleToggleChecklist = (id: string) => {
    if (step1.isLocked) return;
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step1: {
        ...prev.step1,
        checklist: prev.step1.checklist.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item
        ),
      },
    }));
  };

  const handleRemoveChecklist = (id: string) => {
    if (step1.isLocked) return;
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step1: {
        ...prev.step1,
        checklist: prev.step1.checklist.filter((item) => item.id !== id),
      },
    }));
  };

  const handleUnlock = () => {
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step1: {
        ...prev.step1,
        isLocked: false,
      },
    }));
  };

  const handleAiDeepenPrd = async () => {
    if (step1.isLocked) return;
    setAiError(null);
    setIsAssisting(true);
    try {
      const res = await aiStep1Assist(
        {
          projectName: project.name,
          prdText: step1.prdText,
          researchNotes: step1.researchNotes,
          checklist: step1.checklist.map((c) => c.label),
        },
        activeProvider
      );

      onUpdateProject((prev) => {
        const existingLabels = new Set(
          prev.step1.checklist.map((c) => c.label.toLowerCase())
        );
        const newItems = (res.suggestedChecklistItems ?? [])
          .filter((l) => l && !existingLabels.has(l.toLowerCase()))
          .map((label) => ({
            id: createId('chk'),
            label,
            checked: false,
          }));

        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          step1: {
            ...prev.step1,
            prdText: res.prdAdditions
              ? `${prev.step1.prdText.trim()}\n\n[AI Bổ Sung / AI Additions]:\n${res.prdAdditions.trim()}`
              : prev.step1.prdText,
            researchNotes: res.riskNotes
              ? `${prev.step1.researchNotes.trim()}\n\n[Rủi Ro Biên / Edge Risks]:\n${res.riskNotes.trim()}`
              : prev.step1.researchNotes,
            checklist: [...prev.step1.checklist, ...newItems],
          },
        };
      });

      onRecordAiMetric(
        {
          id: createId('met'),
          action: 'Đào sâu PRD & Rủi ro',
          providerLabel: res.meta.providerLabel,
          modelUsed: res.meta.modelUsed,
          latencyMs: res.meta.latencyMs,
          tokensSaved: 0,
          timestamp: new Date().toISOString(),
        },
        `Đã bổ sung phân tích PRD & rủi ro (${res.meta.modelUsed} · ${res.meta.latencyMs}ms).`
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối AI hỗ trợ PRD.'
      );
    } finally {
      setIsAssisting(false);
    }
  };

  const checkedCount = step1.checklist.filter((c) => c.checked).length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      {/* Header Band */}
      <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Bước 1: Gemini App — Lên ý tưởng & Đặc tả (Ideation & PRD)
            </h2>
            <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 whitespace-nowrap shrink-0">
              Không tốn hạn mức code · Zero Dev Quota
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Hoàn tất tư duy sản phẩm, nghiên cứu đối thủ và danh sách tính năng trước khi chạm vào AI Studio hay Antigravity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!step1.isLocked && (
            <button
              type="button"
              disabled={isAssisting}
              onClick={handleAiDeepenPrd}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
            >
              {isAssisting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              )}
              <span>
                {isAssisting
                  ? 'Đang phân tích PRD...'
                  : 'Đào sâu PRD & Rủi ro bằng AI'}
              </span>
            </button>
          )}

          {step1.isLocked && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Đã khóa PRD
                  {step1.lockedAt ? ` (${formatRelativeTime(step1.lockedAt)})` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={handleUnlock}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
              >
                <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Mở khóa để sửa (Unlock)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {aiError && (
        <div
          role="alert"
          className="mx-5 mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200 sm:mx-6"
        >
          {aiError}
        </div>
      )}

      {/* Main Content Split */}
      <div className="grid grid-cols-1 divide-y divide-slate-800 lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* Left: PRD & Deep Research */}
        <div className="space-y-6 p-5 sm:p-6 lg:col-span-7">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="step1-prd"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100"
              >
                <FileText className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <span>Tài liệu Yêu cầu Sản phẩm (Product Requirements Document - PRD)</span>
              </label>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {step1.prdText.trim().length} ký tự
              </span>
            </div>
            <textarea
              id="step1-prd"
              rows={7}
              disabled={step1.isLocked}
              value={step1.prdText}
              onChange={(e) =>
                onUpdateProject((prev) => ({
                  ...prev,
                  updatedAt: new Date().toISOString(),
                  step1: { ...prev.step1, prdText: e.target.value },
                }))
              }
              placeholder="Mô tả mục tiêu cốt lõi, phạm vi MVP và các giới hạn không làm (Non-goals)..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="step1-research"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100"
              >
                <Search className="h-4 w-4 text-sky-400" aria-hidden="true" />
                <span>Ghi chú Nghiên cứu & Đối thủ (Competitor & Deep Research Notes)</span>
              </label>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {step1.researchNotes.trim().length} ký tự
              </span>
            </div>
            <textarea
              id="step1-research"
              rows={5}
              disabled={step1.isLocked}
              value={step1.researchNotes}
              onChange={(e) =>
                onUpdateProject((prev) => ({
                  ...prev,
                  updatedAt: new Date().toISOString(),
                  step1: { ...prev.step1, researchNotes: e.target.value },
                }))
              }
              placeholder="Ghi lại kết quả Deep Research từ Gemini App: kiến trúc đề xuất, rủi ro biên, hoặc thư viện nên dùng..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>
        </div>

        {/* Right: Feature Checklist */}
        <div className="flex flex-col justify-between p-5 sm:p-6 lg:col-span-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
                <ListChecks className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <span>Danh sách Tính năng (Feature Checklist)</span>
              </div>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {checkedCount}/{step1.checklist.length} đã chốt
              </span>
            </div>

            {!step1.isLocked && (
              <form onSubmit={handleAddChecklist} className="flex gap-2">
                <input
                  type="text"
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  placeholder="Thêm hạng mục cần chốt (Add feature item)..."
                  aria-label="Thêm hạng mục danh sách tính năng (Add checklist item)"
                  className="h-10 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                />
                <button
                  type="submit"
                  disabled={!newCheckItem.trim()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Thêm (Add)</span>
                </button>
              </form>
            )}

            {step1.checklist.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                Chưa có đầu mục tính năng nào. Hãy thêm ít nhất 1 đầu mục để khóa PRD.
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950/70">
                {step1.checklist.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 px-3.5 py-3"
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        disabled={step1.isLocked}
                        onChange={() => handleToggleChecklist(item.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-sky-500 disabled:cursor-not-allowed"
                      />
                      <span
                        className={
                          item.checked
                            ? 'text-slate-400 line-through decoration-slate-600'
                            : 'text-slate-200'
                        }
                      >
                        {item.label}
                      </span>
                    </label>
                    {!step1.isLocked && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklist(item.id)}
                        aria-label={`Xóa ${item.label}`}
                        className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Strict Gate Action & Inline Blockers */}
          <div className="mt-6 space-y-3 border-t border-slate-800 pt-5">
            {!step1.isLocked && !gate.allowed && (
              <div
                role="status"
                className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200"
              >
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Cổng kiểm soát nghiêm ngặt (Strict Gate Blockers):</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-amber-100/90">
                  {gate.blockers.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {step1.isLocked ? (
              <button
                type="button"
                onClick={onAdvanceToStep2}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Đi tới Bước 2 — Google AI Studio (Go to Step 2)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!gate.allowed}
                onClick={onAdvanceToStep2}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>Khóa PRD & Sang Bước 2 (Lock PRD & Advance to Step 2)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
