import React, { useState } from 'react';
import { Loader2, Sparkles, Wand2, X } from 'lucide-react';
import { AiProviderProfile, AiRunMetric, Project } from '../types';
import { aiGenerateProject } from '../utils/aiClient';
import { createId, generateStarterProject } from '../utils/quotaHelpers';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider: AiProviderProfile | undefined;
  onCreateProjectDirect: (project: Project, metric?: AiRunMetric) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  activeProvider,
  onCreateProjectDirect,
}) => {
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const validateInputs = () => {
    if (name.trim().length < 2) {
      setError('Vui lòng nhập tên dự án ít nhất 2 ký tự (Project name required).');
      return false;
    }
    if (brief.trim().length < 10) {
      setError(
        'Vui lòng nhập mô tả 1–2 câu ngắn (tối thiểu 10 ký tự) để sinh khung Bước 1–3.'
      );
      return false;
    }
    return true;
  };

  const handleCreateLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;
    const project = generateStarterProject(name.trim(), brief.trim());
    onCreateProjectDirect(project);
    setName('');
    setBrief('');
    setError(null);
    onClose();
  };

  const handleCreateWithAi = async () => {
    if (!validateInputs()) return;
    setError(null);
    setIsGenerating(true);

    try {
      const res = await aiGenerateProject(
        name.trim(),
        brief.trim(),
        activeProvider
      );
      const now = new Date().toISOString();
      const project: Project = {
        id: createId('proj'),
        name: name.trim(),
        summary: brief.trim(),
        currentStep: 1,
        updatedAt: now,
        step1: {
          isLocked: false,
          prdText: res.prdText || generateStarterProject(name, brief).step1.prdText,
          researchNotes:
            res.researchNotes ||
            generateStarterProject(name, brief).step1.researchNotes,
          checklist:
            Array.isArray(res.checklistLabels) && res.checklistLabels.length > 0
              ? res.checklistLabels.map((label, idx) => ({
                  id: createId('chk'),
                  label,
                  checked: idx === 0,
                }))
              : generateStarterProject(name, brief).step1.checklist,
        },
        step2: {
          prototypeStatus: 'not_started',
          exportReady: false,
          repoUrl: '',
          isConfirmed: false,
          prompts:
            Array.isArray(res.prompts) && res.prompts.length > 0
              ? res.prompts.map((p) => ({
                  id: createId('prm'),
                  title: p.title,
                  content: p.content,
                  isProduction: Boolean(p.isProduction),
                }))
              : generateStarterProject(name, brief).step2.prompts,
        },
        step3: {
          tasks:
            Array.isArray(res.tasks) && res.tasks.length > 0
              ? res.tasks.map((t) => ({
                  id: createId('tsk'),
                  title: t.title,
                  targetFiles: t.targetFiles || 'src/index.ts',
                  modelTier: t.modelTier === 'Flash' ? 'Flash' : 'Pro / Claude',
                  prompt: t.prompt,
                  status: 'todo',
                  reviewedDiff: false,
                  createdAt: now,
                }))
              : generateStarterProject(name, brief).step3.tasks,
        },
      };

      const metric: AiRunMetric = {
        id: createId('met'),
        action: 'Sinh khung Dự án (Step 1–3)',
        providerLabel: res.meta.providerLabel,
        modelUsed: res.meta.modelUsed,
        latencyMs: res.meta.latencyMs,
        tokensSaved: 0,
        timestamp: now,
      };

      onCreateProjectDirect(project, metric);
      setName('');
      setBrief('');
      setError(null);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể gọi AI sinh dự án. Bạn có thể dùng nút "Khởi tạo Nhanh (Local)" bên dưới.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <h2
              id="new-project-modal-title"
              className="font-display text-base font-bold text-slate-50"
            >
              Tạo Dự Án Mới (New Project Starter)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ (Close modal)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleCreateLocal} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label
              htmlFor="new-project-name"
              className="block text-xs font-medium text-slate-300"
            >
              Tên dự án (Project Name)
            </label>
            <input
              id="new-project-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ví dụ: Hệ thống Đặt lịch Phòng Lab (Lab Booking Portal)"
              className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="new-project-brief"
              className="block text-xs font-medium text-slate-300"
            >
              Mô tả ngắn 1–2 câu (Minimal 1–2 Sentence Brief)
            </label>
            <textarea
              id="new-project-brief"
              rows={3}
              value={brief}
              onChange={(e) => {
                setBrief(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ví dụ: Công cụ quản lý ca trực kỹ thuật viên kèm kiểm tra xung đột lịch và xuất báo cáo CSV cuối tuần."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3.5 text-xs text-slate-300 space-y-1">
            <div className="flex items-center justify-between gap-2 font-semibold text-slate-200">
              <span>Động cơ AI đang chọn:</span>
              <span className="font-mono text-[11px] text-sky-300">
                {activeProvider?.label ?? 'Gemini Built-in'}
              </span>
            </div>
            <p className="text-slate-400">
              Chọn <strong>Sinh bằng AI</strong> để máy chủ tạo PRD, Checklist, Prompt Lab và Task theo đúng ngữ cảnh dự án, hoặc dùng khung mẫu tức thì.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
            >
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3.5 text-xs font-medium text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              Khởi tạo Khung Nhanh (Local)
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleCreateWithAi}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                {isGenerating ? 'Đang sinh PRD & Task...' : 'Sinh toàn bộ bằng AI (AI Auto-Draft)'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
