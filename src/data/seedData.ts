import { AiProviderProfile, AppSnapshot } from '../types';
import { FIVE_HOURS_MS } from '../utils/quotaHelpers';

export const DEFAULT_AI_PROVIDERS: AiProviderProfile[] = [
  {
    id: 'prov_gemini_builtin',
    label: 'Gemini Built-in (Auto Fast + Balanced)',
    providerKind: 'Google Built-in',
    apiFormat: 'gemini-builtin',
    baseUrl: 'https://generativelanguage.googleapis.com',
    modelId: 'gemini-3.1-flash-lite / gemini-4-hydrogen',
    envVarName: 'GEMINI_API_KEY',
  },
  {
    id: 'prov_openrouter',
    label: 'OpenRouter (Claude / DeepSeek Route)',
    providerKind: 'OpenRouter',
    apiFormat: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'anthropic/claude-3.5-sonnet',
    envVarName: 'OPENROUTER_API_KEY',
  },
  {
    id: 'prov_openai',
    label: 'OpenAI (GPT-4o Mini Fast)',
    providerKind: 'OpenAI',
    apiFormat: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o-mini',
    envVarName: 'OPENAI_API_KEY',
  },
  {
    id: 'prov_local_ollama',
    label: 'Local Ollama (Zero Cloud Quota)',
    providerKind: 'Local Ollama',
    apiFormat: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    modelId: 'qwen2.5-coder:7b',
    envVarName: '',
  },
];

export const SEED_DATA: AppSnapshot = {
  version: 2,
  exportedAt: '2026-11-19T10:30:00.000Z',
  activeProjectId: 'proj_billing_gateway',
  activeAccountId: 'acc_google_pro',
  activeAiProviderId: 'prov_gemini_builtin',
  aiProviders: DEFAULT_AI_PROVIDERS,
  aiMetrics: [],
  cycleState: {
    status: 'idle',
    durationMs: FIVE_HOURS_MS,
    remainingMs: FIVE_HOURS_MS,
    endTimestamp: null,
  },
  projects: [
    {
      id: 'proj_billing_gateway',
      name: 'Cổng Thanh toán SaaS Đa tầng (Multi-Tenant Billing)',
      summary:
        'Hệ thống tính cước theo gói (Subscription & Usage Metering) tích hợp Webhook Stripe và phân quyền RBAC.',
      currentStep: 3,
      updatedAt: '2026-11-19T10:15:00.000Z',
      step1: {
        isLocked: true,
        lockedAt: '2026-11-18T14:20:00.000Z',
        prdText:
          'Mục tiêu cốt lõi (Core Objective): Xây dựng luồng nâng cấp gói thuê bao (Plan Upgrade), xác thực chữ ký Webhook Stripe chống gửi trùng (Idempotency Key), và bảng lịch sử hóa đơn theo tổ chức (Tenant Isolation).\n\nGiới hạn phạm vi (Non-Goals): Chưa hỗ trợ xuất hóa đơn thuế VAT tự động trong giai đoạn MVP.',
        researchNotes:
          'Phân tích đối thủ & kiến trúc (Competitor & Architecture Notes):\n- Stripe Billing Portal giảm 60% mã giao diện thẻ thanh toán.\n- Bắt buộc lưu webhookEventId vào bảng ledger để tránh cộng hạn mức hai lần khi Stripe retry.',
        checklist: [
          {
            id: 'chk_bill_1',
            label: 'Chốt lược đồ bảng Tenant, Subscription và WebhookEvent (DB Schema)',
            checked: true,
          },
          {
            id: 'chk_bill_2',
            label: 'Xác định quy tắc Idempotency chống xử lý trùng sự kiện (Idempotency Guard)',
            checked: true,
          },
          {
            id: 'chk_bill_3',
            label: 'Phân tách quyền Admin tổ chức và Member thường (RBAC Matrix)',
            checked: true,
          },
          {
            id: 'chk_bill_4',
            label: 'Chốt cấu trúc URL & trạng thái lỗi khi thanh toán thất bại (Error States)',
            checked: true,
          },
        ],
      },
      step2: {
        prototypeStatus: 'verified',
        exportReady: true,
        repoUrl: 'https://github.com/dev-studio/multi-tenant-billing-mvp',
        isConfirmed: true,
        confirmedAt: '2026-11-18T19:05:00.000Z',
        prompts: [
          {
            id: 'prm_bill_1',
            title: 'Bản nháp chi tiết ban đầu (Initial Long System Prompt)',
            content:
              'You are a principal TypeScript backend and React frontend architect. Please carefully design and implement a multi-tenant SaaS billing dashboard where organization admins can inspect invoices, upgrade subscription tiers, and verify Stripe webhook idempotency states with clean Slate dark mode styling and full error handling.',
            isProduction: false,
          },
          {
            id: 'prm_bill_2',
            title: 'Bản rút gọn trung bình (Mid-Length Prompt)',
            content:
              'Act as TypeScript fullstack engineer. Build multi-tenant billing panel: plan switcher, invoice table (tabular-nums), Stripe webhook idempotency guard. Dark Slate-950 UI, strict types.',
            isProduction: false,
          },
          {
            id: 'prm_bill_3',
            title: 'Prompt Sản Xuất tối ưu Token (Shortest Accurate Prompt)',
            content:
              'TS+React Billing UI (Slate-950): plan upgrade modal, tabular-nums invoice ledger, strict Stripe webhook idempotency check. No mock stubs.',
            isProduction: true,
          },
        ],
      },
      step3: {
        tasks: [
          {
            id: 'tsk_bill_1',
            title: 'Xác thực chữ ký & chống trùng Webhook Stripe (Webhook Idempotency Guard)',
            targetFiles: 'src/server/webhooks/stripeHandler.ts, src/db/ledgerRepo.ts',
            modelTier: 'Pro / Claude',
            prompt:
              '[Hành động / Action]: Thêm kiểm tra stripe.webhooks.constructEvent và truy vấn bảng processed_events theo event.id trước khi cập nhật gói.\n[Tệp mục tiêu / Target File]: src/server/webhooks/stripeHandler.ts, src/db/ledgerRepo.ts\n[Kết quả kỳ vọng / Expected Output]: Trả HTTP 200 sớm nếu event.id đã tồn tại; gói transaction rollback nếu cập nhật DB thất bại.',
            status: 'done',
            reviewedDiff: true,
            createdAt: '2026-11-19T08:10:00.000Z',
          },
          {
            id: 'tsk_bill_2',
            title: 'Cập nhật middleware kiểm tra hạn mức API theo Tenant (Tenant Quota Middleware)',
            targetFiles: 'src/middleware/quotaGuard.ts',
            modelTier: 'Pro / Claude',
            prompt:
              '[Hành động / Action]: Bổ sung kiểm tra usageCount >= planLimit trước khi cho phép gọi endpoint tạo báo cáo.\n[Tệp mục tiêu / Target File]: src/middleware/quotaGuard.ts\n[Kết quả kỳ vọng / Expected Output]: Trả về mã 429 kèm header Retry-After và thông báo song ngữ rõ ràng.',
            status: 'in_progress',
            reviewedDiff: false,
            createdAt: '2026-11-19T09:45:00.000Z',
          },
          {
            id: 'tsk_bill_3',
            title: 'Căn chỉnh cột số tiền thẳng hàng tabular-nums (Invoice Table Alignment)',
            targetFiles: 'src/components/billing/InvoiceTable.tsx',
            modelTier: 'Flash',
            prompt:
              '[Hành động / Action]: Áp dụng class tabular-nums và căn phải cho cột Số tiền (Amount) và Thuế (Tax) trong bảng hóa đơn.\n[Tệp mục tiêu / Target File]: src/components/billing/InvoiceTable.tsx\n[Kết quả kỳ vọng / Expected Output]: Mọi con số thập phân thẳng hàng dọc, giữ nguyên cấu trúc cột trên mobile.',
            status: 'todo',
            reviewedDiff: false,
            createdAt: '2026-11-19T10:12:00.000Z',
          },
        ],
      },
    },
    {
      id: 'proj_markdown_sync',
      name: 'Đồng bộ Ghi chú Markdown Cục bộ (Local-First Notes Sync)',
      summary:
        'Ứng dụng ghi chú ưu tiên ngoại tuyến (Offline-First) dùng IndexedDB và giải quyết xung đột CRDT nhẹ.',
      currentStep: 1,
      updatedAt: '2026-11-19T09:00:00.000Z',
      step1: {
        isLocked: false,
        prdText:
          'Mục tiêu sản phẩm (Product Goal): Cho phép lập trình viên soạn thảo ghi chú kỹ thuật ngoại tuyến, tìm kiếm toàn văn tức thì (Instant Full-Text Search) và đồng bộ sang GitHub Gist khi có mạng.',
        researchNotes:
          'So sánh giải pháp (Technical Research):\n- IndexedDB kết hợp Dexie nhẹ hơn SQLite Wasm cho tập ghi chú < 10.000 tệp.\n- Dùng hash SHA-256 trên nội dung Markdown để phát hiện xung đột trước khi đẩy lên Gist.',
        checklist: [
          {
            id: 'chk_md_1',
            label: 'Xác định cấu trúc Metadata Frontmatter (id, updatedAt, sha256)',
            checked: true,
          },
          {
            id: 'chk_md_2',
            label: 'Thiết kế luồng xử lý xung đột 2 phiên bản (Conflict Merge Modal)',
            checked: true,
          },
          {
            id: 'chk_md_3',
            label: 'Chốt danh sách phím tắt trình soạn thảo (Keyboard Shortcuts)',
            checked: false,
          },
        ],
      },
      step2: {
        prototypeStatus: 'not_started',
        exportReady: false,
        repoUrl: 'https://github.com/dev-studio/local-markdown-sync',
        isConfirmed: false,
        prompts: [
          {
            id: 'prm_md_1',
            title: 'Prompt Khung Giao Diện (Workspace Shell Prompt)',
            content:
              'Create a dark-mode Markdown workspace with sidebar file tree, live split preview, and offline sync status indicator using React and Tailwind CSS.',
            isProduction: true,
          },
        ],
      },
      step3: {
        tasks: [
          {
            id: 'tsk_md_1',
            title: 'Khởi tạo lớp lưu trữ IndexedDB cho Notes (Local Store Adapter)',
            targetFiles: 'src/storage/notesIndexedDb.ts',
            modelTier: 'Pro / Claude',
            prompt:
              '[Hành động / Action]: Viết wrapper CRUD cho IndexedDB lưu trữ NoteRecord kèm chỉ mục updatedAt.\n[Tệp mục tiêu / Target File]: src/storage/notesIndexedDb.ts\n[Kết quả kỳ vọng / Expected Output]: Hỗ trợ getAllNotes, saveNote, deleteNote và xử lý lỗi quota trình duyệt.',
            status: 'todo',
            reviewedDiff: false,
            createdAt: '2026-11-19T09:00:00.000Z',
          },
        ],
      },
    },
  ],
  accounts: [
    {
      id: 'acc_google_pro',
      label: 'Google Chính (Antigravity Pro)',
      emailOrHandle: 'minh.architect@gmail.com',
      provider: 'Google',
      quotaMode: '5h Pro Cycle',
      lastActiveAt: '2026-11-19T10:30:00.000Z',
      sessionNote:
        'Đang hoàn thiện middleware quotaGuard.ts. Còn ~2 tác vụ trước khi đổi sang tài khoản phụ.',
    },
    {
      id: 'acc_claude_arch',
      label: 'Claude Kiến Trúc (Anthropic Team)',
      emailOrHandle: 'arch-ops@studio-team.io',
      provider: 'Claude / Anthropic',
      quotaMode: 'API / Pay-as-you-go',
      lastActiveAt: '2026-11-19T07:50:00.000Z',
      sessionNote:
        'Dùng chuyên cho review diff bảo mật và debug đa tệp phức tạp (multi-file DB transaction).',
    },
    {
      id: 'acc_github_local',
      label: 'GitHub & Local Backup',
      emailOrHandle: '@minh-dev-vn',
      provider: 'GitHub',
      quotaMode: 'Local / Unlimited',
      lastActiveAt: '2026-11-18T21:15:00.000Z',
      sessionNote:
        'Tài khoản đẩy mã nguồn nhánh staging và chạy kiểm thử tích hợp cục bộ.',
    },
  ],
  checkpoints: [
    {
      id: 'cp_seed_1',
      timestamp: '2026-11-19T08:05:00.000Z',
      fromAccountLabel: 'Claude Kiến Trúc (Anthropic Team)',
      toAccountLabel: 'Google Chính (Antigravity Pro)',
      projectId: 'proj_billing_gateway',
      projectName: 'Cổng Thanh toán SaaS Đa tầng (Multi-Tenant Billing)',
      funnelStep: 3,
      nextTaskTitle: 'Cập nhật middleware kiểm tra hạn mức API theo Tenant',
      note: 'Đã chốt xong webhook idempotency, chuyển sang chu kỳ 5h để dựng middleware.',
    },
  ],
};
