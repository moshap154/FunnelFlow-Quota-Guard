import {
  AccountProfile,
  AppSnapshot,
  GateCheckResult,
  LinterAnalysis,
  LinterIssue,
  ModelTier,
  Project,
  QuotaCycleState,
} from '../types';

export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
export const PEAK_WINDOW_THRESHOLD_MS = 2 * 60 * 60 * 1000; // First 3 hours => remaining > 2h

const VAGUE_PHRASES = [
  'make it better',
  'fix everything',
  'improve ui',
  'improve the ui',
  'refactor everything',
  'optimize all',
  'clean up all',
  'tối ưu toàn bộ',
  'sửa hết lỗi',
  'làm đẹp hơn',
  'viết lại hết',
  'nâng cấp toàn bộ',
  'cải thiện giao diện',
  'fix all bugs',
];

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function formatCountdown(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':');
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function evaluateStep1Gate(project: Project): GateCheckResult {
  const blockers: string[] = [];
  const { prdText, researchNotes, checklist } = project.step1;

  if (prdText.trim().length < 20) {
    blockers.push(
      'Tài liệu PRD cần tối thiểu 20 ký tự mô tả phạm vi (PRD requires at least 20 characters).'
    );
  }
  if (researchNotes.trim().length < 15) {
    blockers.push(
      'Ghi chú nghiên cứu đối thủ / kỹ thuật cần tối thiểu 15 ký tự (Research Notes required).'
    );
  }
  if (checklist.length === 0) {
    blockers.push(
      'Cần ít nhất 1 đầu mục trong Danh sách tính năng (Feature Checklist cannot be empty).'
    );
  } else {
    const uncheckedCount = checklist.filter((item) => !item.checked).length;
    if (uncheckedCount > 0) {
      blockers.push(
        `Còn ${uncheckedCount} đầu mục trong Danh sách tính năng chưa được xác nhận hoàn tất (${uncheckedCount} checklist items unchecked).`
      );
    }
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

export function evaluateStep2Gate(project: Project): GateCheckResult {
  const blockers: string[] = [];
  const { prototypeStatus, prompts } = project.step2;

  if (prototypeStatus !== 'verified') {
    blockers.push(
      'Trạng thái nguyên mẫu phải đạt "Đã xác minh trên trình duyệt (Verified in Browser)" trước khi sang Bước 3.'
    );
  }

  const hasProductionPrompt = prompts.some(
    (p) => p.isProduction && p.content.trim().length >= 15
  );
  if (!hasProductionPrompt) {
    blockers.push(
      'Cần đánh dấu ít nhất 1 biến thể hợp lệ làm "Prompt Sản Xuất (Production Prompt)" trong Phòng lab Prompt.'
    );
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

export function analyzePromptLinter(
  targetFiles: string,
  prompt: string,
  modelTier: ModelTier,
  taskTitle?: string
): LinterAnalysis {
  const issues: LinterIssue[] = [];
  const cleanTarget = targetFiles.trim();
  const cleanPrompt = prompt.trim();
  const lowerPrompt = cleanPrompt.toLowerCase();

  if (!cleanTarget) {
    issues.push({
      id: 'missing_target_file',
      severity: 'error',
      message:
        'Thiếu Tệp mục tiêu (Target File): Bắt buộc chỉ định rõ đường dẫn tệp (ví dụ: src/auth/session.ts) để agent không quét toàn bộ repo gây đốt hạn mức (quota burnout).',
    });
  }

  if (cleanPrompt.length > 0 && cleanPrompt.length < 25) {
    issues.push({
      id: 'prompt_too_short',
      severity: 'warning',
      message:
        'Prompt quá ngắn (< 25 ký tự / Prompt too short): Thiếu hành động cụ thể và kết quả kỳ vọng (Expected Output), dễ khiến agent hỏi lại hoặc sửa lan man.',
    });
  } else if (cleanPrompt.length === 0) {
    issues.push({
      id: 'empty_prompt',
      severity: 'error',
      message:
        'Chưa nhập Agent Prompt: Hãy mô tả rõ hành động cần thực hiện trên tệp mục tiêu.',
    });
  }

  const matchedVaguePhrases = VAGUE_PHRASES.filter((phrase) =>
    lowerPrompt.includes(phrase)
  );

  if (matchedVaguePhrases.length > 0) {
    issues.push({
      id: 'vague_scope',
      severity: 'warning',
      message: `Phát hiện cụm từ mơ hồ ("${matchedVaguePhrases.join('", "')}"): Yêu cầu không giới hạn phạm vi sẽ khiến mô hình đọc/sửa hàng loạt tệp không cần thiết.`,
    });
  }

  // Soft quota tier check
  if (
    modelTier === 'Pro / Claude' &&
    cleanPrompt.length > 0 &&
    (lowerPrompt.includes('padding') ||
      lowerPrompt.includes('margin') ||
      lowerPrompt.includes('color') ||
      lowerPrompt.includes('đổi màu') ||
      lowerPrompt.includes('css')) &&
    !cleanTarget.includes(',')
  ) {
    issues.push({
      id: 'tier_overkill',
      severity: 'warning',
      message:
        'Gợi ý tiết kiệm hạn mức (Model Tier Hint): Chỉnh sửa UI/CSS đơn tệp nên chọn tầng "Flash" thay vì tiêu tốn hạn mức "Pro / Claude".',
    });
  }

  const targetPlaceholder = cleanTarget || 'src/features/billing/webhook.ts';
  const actionLabel = taskTitle?.trim()
    ? `Cập nhật logic cho "${taskTitle.trim()}"`
    : 'Sửa hàm xử lý xác thực token (Update token validation handler)';

  const suggestedTemplate = `[Hành động / Action]: ${actionLabel}
[Tệp mục tiêu / Target File]: ${targetPlaceholder}
[Kết quả kỳ vọng / Expected Output]: Chỉ chỉnh sửa trong ${targetPlaceholder}, giữ nguyên API hiện có, trả về diff gọn và bổ sung kiểm tra lỗi biên (edge-case guard).`;

  const hasError = issues.some((i) => i.severity === 'error');
  const hasWarning = issues.some((i) => i.severity === 'warning');

  return {
    severity: hasError ? 'error' : hasWarning ? 'warning' : 'ok',
    issues,
    matchedVaguePhrases,
    suggestedTemplate,
  };
}

export function generateStarterProject(name: string, brief: string): Project {
  const cleanName = name.trim() || 'Dự án Mới (Untitled Project)';
  const cleanBrief =
    brief.trim() ||
    'Xây dựng công cụ web tập trung vào quy trình gọn nhẹ và kiểm soát hiệu năng.';
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'app-module';

  const now = new Date().toISOString();

  return {
    id: createId('proj'),
    name: cleanName,
    summary: cleanBrief,
    currentStep: 1,
    updatedAt: now,
    step1: {
      isLocked: false,
      prdText: `Mục tiêu sản phẩm (Product Goal):\n${cleanBrief}\n\nPhạm vi lõi MVP (Core Scope):\n- Giải quyết dứt điểm luồng thao tác chính trước khi mở rộng tính năng phụ.\n- Tách biệt lớp giao diện (UI Layer) và lớp lưu trữ/nghiệp vụ để dễ khoanh vùng tệp khi giao cho agent.`,
      researchNotes: `Ghi chú đối chiếu (Research & Trade-offs):\n- Ưu tiên sử dụng thành phần có sẵn và kiểu dữ liệu chặt chẽ (TypeScript strict interfaces).\n- Đẩy toàn bộ bước suy luận kiến trúc vào Gemini App trước khi viết mã thật.`,
      checklist: [
        {
          id: createId('chk'),
          label: `Chốt mô hình dữ liệu & ranh giới state cho ${cleanName} (Define data schema)`,
          checked: true,
        },
        {
          id: createId('chk'),
          label: 'Xác nhận luồng thao tác người dùng không có bước thừa (Verify UX flow)',
          checked: false,
        },
        {
          id: createId('chk'),
          label: 'Liệt kê danh sách tệp mục tiêu dự kiến (Map target file paths)',
          checked: false,
        },
        {
          id: createId('chk'),
          label: 'Định nghĩa tiêu chí hoàn tất MVP (Define acceptance criteria)',
          checked: false,
        },
      ],
    },
    step2: {
      prototypeStatus: 'not_started',
      exportReady: false,
      repoUrl: `https://github.com/workspace/${slug}`,
      isConfirmed: false,
      prompts: [
        {
          id: createId('prm'),
          title: 'Bản nháp đầy đủ ngữ cảnh (Verbose Context Draft)',
          content: `Bạn là kỹ sư giao diện cao cấp. Hãy xây dựng nguyên mẫu giao diện cho dự án "${cleanName}" với mô tả: ${cleanBrief}. Sử dụng React, TypeScript và Tailwind CSS nền tối Slate-950, đảm bảo mọi nút đều có trình xử lý thật.`,
          isProduction: false,
        },
        {
          id: createId('prm'),
          title: 'Bản tinh gọn tối ưu Token (Concise Production Candidate)',
          content: `Build React+TS+Tailwind dark UI (Slate-950) for "${cleanName}": ${cleanBrief}. Wire all handlers, tabular-nums for metrics, zero placeholder stubs.`,
          isProduction: true,
        },
      ],
    },
    step3: {
      tasks: [
        {
          id: createId('tsk'),
          title: `Thiết lập kiểu dữ liệu & state khởi tạo cho ${cleanName} (Core Schema & State)`,
          targetFiles: `src/types/${slug}.ts, src/state/store.ts`,
          modelTier: 'Pro / Claude',
          prompt: `[Hành động / Action]: Định nghĩa interface TypeScript và hàm lưu trữ state.\n[Tệp mục tiêu / Target File]: src/types/${slug}.ts, src/state/store.ts\n[Kết quả kỳ vọng / Expected Output]: Đủ kiểu dữ liệu nghiêm ngặt cho luồng "${cleanBrief}", không dùng any, hỗ trợ đọc/ghi an toàn.`,
          status: 'todo',
          reviewedDiff: false,
          createdAt: now,
        },
        {
          id: createId('tsk'),
          title: 'Tinh chỉnh tương phản & trạng thái rỗng (UI Polish & Empty State)',
          targetFiles: `src/components/${slug}Panel.tsx`,
          modelTier: 'Flash',
          prompt: `[Hành động / Action]: Bổ sung trạng thái rỗng (empty state) và focus-visible ring.\n[Tệp mục tiêu / Target File]: src/components/${slug}Panel.tsx\n[Kết quả kỳ vọng / Expected Output]: Nút tạo mới hoạt động đúng, đạt chuẩn tương phản WCAG AA trên nền Slate-900.`,
          status: 'todo',
          reviewedDiff: false,
          createdAt: now,
        },
      ],
    },
  };
}

export function getCycleWindowInfo(cycleState: QuotaCycleState): {
  mode: 'peak' | 'low' | 'idle' | 'expired';
  title: string;
  guidance: string;
} {
  if (cycleState.status === 'idle') {
    return {
      mode: 'idle',
      title: 'Chờ kích hoạt (Cycle Idle)',
      guidance:
        'Bấm "Bắt đầu Chu kỳ 5h (Start 5h Heavy Cycle)" khi bắt đầu phiên Antigravity để theo dõi cửa sổ cao điểm.',
    };
  }
  if (cycleState.status === 'expired' || cycleState.remainingMs <= 0) {
    return {
      mode: 'expired',
      title: 'Hết chu kỳ 5h (Cycle Expired)',
      guidance:
        'Chu kỳ 5 giờ đã kết thúc. Hãy sao chép Handoff Brief để chuyển tài khoản hoặc đặt lại đồng hồ khi hạn mức hồi phục.',
    };
  }
  if (cycleState.remainingMs > PEAK_WINDOW_THRESHOLD_MS) {
    return {
      mode: 'peak',
      title: 'Cửa sổ Cao điểm (Peak Window)',
      guidance:
        'Ưu tiên tác vụ Kiến trúc / DB / Auth nặng (Prioritize Heavy Architecture / DB / Auth tasks).',
    };
  }
  return {
    mode: 'low',
    title: 'Cửa sổ Thấp (Low Window)',
    guidance:
      'Dùng Flash chỉnh UI nhẹ hoặc đẩy phần nghiên cứu sang Gemini App (Use Flash UI tweaks or offload research to Gemini App).',
  };
}

export function buildHandoffBrief(
  project: Project | undefined,
  account: AccountProfile | undefined,
  cycleState: QuotaCycleState
): string {
  const stepNames: Record<number, string> = {
    1: 'Bước 1 — Gemini App (Ideation & PRD)',
    2: 'Bước 2 — Google AI Studio (Prototype & Prompt Lab)',
    3: 'Bước 3 — Google Antigravity (Heavy Build & Quota Guard)',
  };

  const nextTask = project?.step3.tasks.find((t) => t.status !== 'done');
  const windowInfo = getCycleWindowInfo(cycleState);

  return [
    '=== FUNNELFLOW QUOTA GUARD — HANDOFF BRIEF ===',
    `Tài khoản hiện tại (Active Account): ${account ? `${account.label} (${account.emailOrHandle} · ${account.provider} · ${account.quotaMode})` : 'N/A'}`,
    `Dự án (Project): ${project ? project.name : 'Chưa chọn'}`,
    `Bước hiện tại (Funnel Step): ${project ? stepNames[project.currentStep] : 'N/A'}`,
    `Chu kỳ 5h (Quota Window): ${formatCountdown(cycleState.remainingMs)} — ${windowInfo.title}`,
    `Tác vụ kế tiếp (Next Scoped Task): ${nextTask ? `${nextTask.title} [${nextTask.modelTier}]` : 'Không có tác vụ tồn đọng (No pending tasks)'}`,
    `Tệp mục tiêu (Target Files): ${nextTask ? nextTask.targetFiles : 'N/A'}`,
    `Ghi chú phiên cuối (Session Note): ${account?.sessionNote?.trim() || 'Không có ghi chú thêm.'}`,
    '==============================================',
  ].join('\n');
}

export function validateSnapshot(raw: unknown): AppSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<AppSnapshot>;
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.accounts)) {
    return null;
  }
  if (candidate.projects.length === 0 || candidate.accounts.length === 0) {
    return null;
  }

  const validProjects = candidate.projects.every(
    (p) =>
      p &&
      typeof p.id === 'string' &&
      typeof p.name === 'string' &&
      p.step1 &&
      p.step2 &&
      p.step3
  );
  const validAccounts = candidate.accounts.every(
    (a) => a && typeof a.id === 'string' && typeof a.label === 'string'
  );

  if (!validProjects || !validAccounts) return null;

  const defaultProviders = [
    {
      id: 'prov_gemini_builtin',
      label: 'Gemini Built-in (Auto Fast + Balanced)',
      providerKind: 'Google Built-in' as const,
      apiFormat: 'gemini-builtin' as const,
      baseUrl: 'https://generativelanguage.googleapis.com',
      modelId: 'gemini-3.1-flash-lite / gemini-4-hydrogen',
      envVarName: 'GEMINI_API_KEY',
    },
  ];

  const aiProviders =
    Array.isArray(candidate.aiProviders) && candidate.aiProviders.length > 0
      ? candidate.aiProviders
      : defaultProviders;

  return {
    version: typeof candidate.version === 'number' ? candidate.version : 2,
    exportedAt:
      typeof candidate.exportedAt === 'string'
        ? candidate.exportedAt
        : new Date().toISOString(),
    projects: candidate.projects,
    activeProjectId:
      typeof candidate.activeProjectId === 'string'
        ? candidate.activeProjectId
        : candidate.projects[0].id,
    accounts: candidate.accounts,
    activeAccountId:
      typeof candidate.activeAccountId === 'string'
        ? candidate.activeAccountId
        : candidate.accounts[0].id,
    cycleState: candidate.cycleState ?? {
      status: 'idle',
      durationMs: FIVE_HOURS_MS,
      remainingMs: FIVE_HOURS_MS,
      endTimestamp: null,
    },
    checkpoints: Array.isArray(candidate.checkpoints) ? candidate.checkpoints : [],
    aiProviders,
    activeAiProviderId:
      typeof candidate.activeAiProviderId === 'string'
        ? candidate.activeAiProviderId
        : aiProviders[0].id,
    aiMetrics: Array.isArray(candidate.aiMetrics) ? candidate.aiMetrics : [],
  };
}
