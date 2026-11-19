import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  GitBranch,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  AiProviderProfile,
  AiRunMetric,
  Project,
  PrototypeStatus,
} from '../types';
import { aiCompressPrompt } from '../utils/aiClient';
import {
  createId,
  estimateTokens,
  evaluateStep2Gate,
} from '../utils/quotaHelpers';

interface Step2PromptLabProps {
  project: Project;
  activeProvider: AiProviderProfile | undefined;
  onUpdateProject: (updater: (prev: Project) => Project) => void;
  onAdvanceToStep3: () => void;
  onCopyText: (text: string, label: string) => void;
  onRecordAiMetric: (metric: AiRunMetric, toastMessage?: string) => void;
}

export const Step2PromptLab: React.FC<Step2PromptLabProps> = ({
  project,
  activeProvider,
  onUpdateProject,
  onAdvanceToStep3,
  onCopyText,
  onRecordAiMetric,
}) => {
  const { step2 } = project;
  const gate = evaluateStep2Gate(project);
  const [compressingId, setCompressingId] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const statusOptions: { value: PrototypeStatus; label: string }[] = [
    { value: 'not_started', label: 'Chưa bắt đầu (Not Started)' },
    { value: 'building', label: 'Đang dựng (Building)' },
    {
      value: 'verified',
      label: 'Đã xác minh trên trình duyệt (Verified in Browser)',
    },
  ];

  const promptMetrics = useMemo(() => {
    const nonEmpty = step2.prompts.filter((p) => p.content.trim().length > 0);
    if (nonEmpty.length === 0) {
      return { shortestId: null, maxTokens: 0, productionTokens: 0 };
    }
    let shortest = nonEmpty[0];
    let maxTokens = estimateTokens(nonEmpty[0].content);

    for (const p of nonEmpty) {
      const tokens = estimateTokens(p.content);
      if (tokens < estimateTokens(shortest.content)) {
        shortest = p;
      }
      if (tokens > maxTokens) {
        maxTokens = tokens;
      }
    }

    const prod = step2.prompts.find((p) => p.isProduction);
    const productionTokens = prod ? estimateTokens(prod.content) : 0;

    return {
      shortestId: shortest.id,
      maxTokens,
      productionTokens,
    };
  }, [step2.prompts]);

  const handleAddPrompt = () => {
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step2: {
        ...prev.step2,
        prompts: [
          ...prev.step2.prompts,
          {
            id: createId('prm'),
            title: `Biến thể Prompt #${prev.step2.prompts.length + 1} (Prompt Variant)`,
            content: '',
            isProduction: false,
          },
        ],
      },
    }));
  };

  const handleUpdatePrompt = (
    id: string,
    patch: { title?: string; content?: string; isProduction?: boolean }
  ) => {
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step2: {
        ...prev.step2,
        prompts: prev.step2.prompts.map((p) => {
          if (patch.isProduction === true) {
            return p.id === id
              ? { ...p, ...patch, isProduction: true }
              : { ...p, isProduction: false };
          }
          return p.id === id ? { ...p, ...patch } : p;
        }),
      },
    }));
  };

  const handleDeletePrompt = (id: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      step2: {
        ...prev.step2,
        prompts: prev.step2.prompts.filter((p) => p.id !== id),
      },
    }));
  };

  const handleCompressWithAi = async (variantId: string, content: string) => {
    if (!content.trim()) return;
    setAiError(null);
    setAiNote(null);
    setCompressingId(variantId);

    try {
      const beforeTokens = estimateTokens(content);
      const res = await aiCompressPrompt(
        { promptText: content, projectName: project.name },
        activeProvider
      );
      const afterTokens = estimateTokens(res.compressedPrompt);
      const saved = Math.max(0, beforeTokens - afterTokens);

      onUpdateProject((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        step2: {
          ...prev.step2,
          prompts: [
            ...prev.step2.prompts.map((p) => ({ ...p, isProduction: false })),
            {
              id: createId('prm'),
              title: res.compressedTitle || 'AI Compressed Production Prompt',
              content: res.compressedPrompt,
              isProduction: true,
            },
          ],
        },
      }));

      setAiNote(
        `${res.rationale} (Giảm từ ~${beforeTokens} xuống ~${afterTokens} tokens · ${res.meta.modelUsed} · ${res.meta.latencyMs}ms)`
      );

      onRecordAiMetric(
        {
          id: createId('met'),
          action: 'Nén System Prompt',
          providerLabel: res.meta.providerLabel,
          modelUsed: res.meta.modelUsed,
          latencyMs: res.meta.latencyMs,
          tokensSaved: saved,
          timestamp: new Date().toISOString(),
        },
        `Đã nén Prompt và tiết kiệm ~${saved} tokens (${res.meta.latencyMs}ms).`
      );
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Không thể nén Prompt bằng AI.'
      );
    } finally {
      setCompressingId(null);
    }
  };

  const tokenSaved =
    promptMetrics.maxTokens > 0 &&
    promptMetrics.productionTokens > 0 &&
    promptMetrics.maxTokens > promptMetrics.productionTokens
      ? promptMetrics.maxTokens - promptMetrics.productionTokens
      : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      {/* Header Band */}
      <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-slate-50">
              Bước 2: Google AI Studio — Nguyên mẫu & Phòng Lab Prompt (Prototype & Prompt Lab)
            </h2>
            <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-300 whitespace-nowrap shrink-0">
              Kiểm chứng miễn phí · Free Tier Validation
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Kiểm tra giao diện chạy thực trên trình duyệt, gắn Repo GitHub/Zip và dùng AI nén System Prompt trước khi chuyển sang Antigravity.
          </p>
        </div>

        {step2.isConfirmed && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Đã xác nhận sang Bước 3</span>
          </span>
        )}
      </div>

      {/* Prototype Verification & GitHub/Zip Export Strip */}
      <div className="grid grid-cols-1 gap-5 border-b border-slate-800 p-5 sm:p-6 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-6">
          <span className="block text-xs font-semibold text-slate-300">
            Trạng thái Nguyên mẫu (Prototype Validation Status)
          </span>
          <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1 sm:grid-cols-3">
            {statusOptions.map((opt) => {
              const active = step2.prototypeStatus === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      updatedAt: new Date().toISOString(),
                      step2: { ...prev.step2, prototypeStatus: opt.value },
                    }))
                  }
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    active
                      ? opt.value === 'verified'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="step2-repo-url"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300"
            >
              <GitBranch className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>Liên kết Xuất mã GitHub / Zip (Repo / Export URL)</span>
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-300">
              <input
                type="checkbox"
                checked={step2.exportReady}
                onChange={(e) =>
                  onUpdateProject((prev) => ({
                    ...prev,
                    updatedAt: new Date().toISOString(),
                    step2: { ...prev.step2, exportReady: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-sky-500"
              />
              <span>Đã xuất GitHub / Zip (Exported)</span>
            </label>
          </div>
          <input
            id="step2-repo-url"
            type="url"
            value={step2.repoUrl}
            onChange={(e) =>
              onUpdateProject((prev) => ({
                ...prev,
                updatedAt: new Date().toISOString(),
                step2: { ...prev.step2, repoUrl: e.target.value },
              }))
            }
            placeholder="https://github.com/your-org/prototype-repo"
            className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>
      </div>

      {/* System Prompt Optimizer Lab */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <h3 className="font-display text-base font-bold text-slate-100">
                Phòng Lab Tối Ưu System Prompt (System Prompt Optimizer Lab)
              </h3>
              {tokenSaved > 0 && (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-medium text-emerald-300 tabular-nums">
                  Tiết kiệm ~{tokenSaved} tokens so với bản dài nhất
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              So sánh số ký tự & token ước tính (<span className="font-mono">~chars / 4</span>) hoặc bấm <strong>Nén bằng AI</strong> để rút gọn thành <strong>Prompt Sản Xuất (Production Prompt)</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddPrompt}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>Thêm biến thể Prompt (Add Variant)</span>
          </button>
        </div>

        {aiNote && (
          <div
            role="status"
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200"
          >
            {aiNote}
          </div>
        )}
        {aiError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            {aiError}
          </div>
        )}

        <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/70">
          {step2.prompts.map((variant) => {
            const chars = variant.content.trim().length;
            const tokens = estimateTokens(variant.content);
            const isShortest =
              promptMetrics.shortestId === variant.id && step2.prompts.length > 1;
            const isCompressing = compressingId === variant.id;

            return (
              <div key={variant.id} className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <input
                    type="text"
                    value={variant.title}
                    onChange={(e) =>
                      handleUpdatePrompt(variant.id, { title: e.target.value })
                    }
                    aria-label="Tiêu đề biến thể prompt (Prompt variant title)"
                    className="h-9 flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  />

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      {chars} chars · ~{tokens} tokens
                    </span>

                    {isShortest && (
                      <span className="inline-flex items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300 whitespace-nowrap">
                        Ngắn nhất (Shortest)
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={!variant.content.trim() || compressingId !== null}
                      onClick={() =>
                        handleCompressWithAi(variant.id, variant.content)
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                    >
                      {isCompressing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                      )}
                      <span>{isCompressing ? 'Đang nén...' : 'Nén bằng AI'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleUpdatePrompt(variant.id, {
                          isProduction: !variant.isProduction,
                        })
                      }
                      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 whitespace-nowrap ${
                        variant.isProduction
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {variant.isProduction ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>Prompt Sản Xuất (Production)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onCopyText(variant.content, `Prompt "${variant.title}"`)
                      }
                      disabled={!variant.content.trim()}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copy</span>
                    </button>

                    {step2.prompts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePrompt(variant.id)}
                        aria-label={`Xóa ${variant.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-400 hover:border-rose-500/40 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={variant.content}
                  onChange={(e) =>
                    handleUpdatePrompt(variant.id, { content: e.target.value })
                  }
                  placeholder="Nhập nội dung System Prompt để đo số ký tự và ước tính token..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </div>
            );
          })}
        </div>

        {/* Strict Step 2 -> Step 3 Gate */}
        <div className="space-y-3 border-t border-slate-800 pt-5">
          {!gate.allowed && (
            <div
              role="status"
              className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200"
            >
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Điều kiện bắt buộc để sang Bước 3 (Strict Step 2 Gate):</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-amber-100/90">
                {gate.blockers.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!gate.allowed}
              onClick={onAdvanceToStep3}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {gate.allowed ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Lock className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {step2.isConfirmed
                  ? 'Đi tới Bước 3 — Google Antigravity (Go to Step 3)'
                  : 'Xác nhận Prototype & Sang Bước 3 (Confirm & Advance to Step 3)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
