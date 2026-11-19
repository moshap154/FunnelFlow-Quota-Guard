import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

type ApiFormat = 'gemini-builtin' | 'openai-compatible' | 'anthropic';

interface ProviderConfig {
  id?: string;
  label?: string;
  apiFormat?: ApiFormat;
  baseUrl?: string;
  modelId?: string;
  envVarName?: string;
}

const FAST_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const BALANCED_GEMINI_MODEL = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isSafeEnvVarName(name: string): boolean {
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(name);
}

function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    );
  } catch {
    return false;
  }
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  return JSON.parse(candidate) as Record<string, unknown>;
}

async function callThirdPartyText(
  provider: ProviderConfig,
  systemInstruction: string,
  userPrompt: string,
  expectJson: boolean
): Promise<{ text: string; modelUsed: string; providerLabel: string }> {
  const format = provider.apiFormat ?? 'openai-compatible';
  const baseUrl = (provider.baseUrl ?? '').trim().replace(/\/+$/, '');
  const modelId = (provider.modelId ?? '').trim();
  const envVarName = (provider.envVarName ?? '').trim();
  const providerLabel = provider.label?.trim() || '3rd-Party API';

  if (!baseUrl) {
    throw new Error(
      `Nguồn "${providerLabel}" thiếu Base Endpoint URL (Missing baseUrl).`
    );
  }
  if (!modelId) {
    throw new Error(
      `Nguồn "${providerLabel}" thiếu Model ID (Missing modelId).`
    );
  }

  let secret = '';
  if (envVarName) {
    if (!isSafeEnvVarName(envVarName)) {
      throw new Error(
        `Tên biến môi trường "${envVarName}" không hợp lệ (chỉ dùng chữ hoa A-Z, số 0-9 và gạch dưới _).`
      );
    }
    secret = process.env[envVarName] ?? '';
    if (!secret && !isLocalhostUrl(baseUrl)) {
      throw new Error(
        `Chưa cấu hình biến môi trường ${envVarName} trong Settings > Secrets trên máy chủ. Hãy thêm ${envVarName} hoặc chuyển về động cơ Gemini Built-in.`
      );
    }
  } else if (!isLocalhostUrl(baseUrl)) {
    throw new Error(
      `Endpoint từ xa "${baseUrl}" yêu cầu tên biến môi trường chứa API key (envVarName).`
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    if (format === 'anthropic') {
      const endpoint = baseUrl.endsWith('/messages')
        ? baseUrl
        : `${baseUrl}/messages`;
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secret,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 1400,
          system: expectJson
            ? `${systemInstruction}\nReturn ONLY valid raw JSON without markdown fences.`
            : systemInstruction,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic API (${res.status}): ${errText.slice(0, 220)}`);
      }
      const data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const text =
        data.content?.find((c) => c.type === 'text')?.text?.trim() ?? '';
      return { text, modelUsed: modelId, providerLabel };
    }

    // OpenAI-compatible (OpenAI, OpenRouter, Groq, DeepSeek, Local Ollama /v1)
    const endpoint = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }

    const bodyPayload: Record<string, unknown> = {
      model: modelId,
      messages: [
        {
          role: 'system',
          content: expectJson
            ? `${systemInstruction}\nReturn ONLY valid JSON object.`
            : systemInstruction,
        },
        { role: 'user', content: userPrompt },
      ],
    };
    if (expectJson && !isLocalhostUrl(baseUrl)) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `3rd-Party API (${res.status}): ${errText.slice(0, 220)}`
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    return { text, modelUsed: modelId, providerLabel };
  } finally {
    clearTimeout(timer);
  }
}

function handleApiError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : 'Lỗi máy chủ AI không xác định.';
  const statusMatch = message.match(/\b(400|401|403|404|429)\b/);
  const status = statusMatch ? Number(statusMatch[1]) : 500;

  let friendlyMessage = message;
  if (message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED')) {
    friendlyMessage =
      'API Key Gemini chưa hợp lệ hoặc thiếu quyền. Vui lòng kiểm tra GEMINI_API_KEY trong bảng Settings > Secrets.';
  } else if (message.includes('RESOURCE_EXHAUSTED')) {
    friendlyMessage =
      'Đạt giới hạn lượt gọi tạm thời (429 Quota). Hãy thử lại sau vài giây hoặc chuyển sang nguồn tài khoản phụ.';
  }

  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: friendlyMessage,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // 1. Provider & Server Secret Readiness Status
  app.get('/api/ai/providers/status', (req: Request, res: Response) => {
    const rawVars = typeof req.query.envVars === 'string' ? req.query.envVars : '';
    const requestedVars = rawVars
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && isSafeEnvVarName(s));

    const defaultEnvChecks = [
      'OPENAI_API_KEY',
      'OPENROUTER_API_KEY',
      'ANTHROPIC_API_KEY',
      'GROQ_API_KEY',
    ];
    const allVars = Array.from(new Set([...defaultEnvChecks, ...requestedVars]));
    const envStatus: Record<string, boolean> = {};
    for (const v of allVars) {
      envStatus[v] = Boolean(process.env[v] && process.env[v]!.trim().length > 0);
    }

    res.json({
      geminiReady: Boolean(getGeminiClient()),
      envStatus,
      recommendedModels: {
        fast: FAST_GEMINI_MODEL,
        balanced: BALANCED_GEMINI_MODEL,
      },
    });
  });

  // 2. Generate Bilingual Starter Project (PRD + Research + Checklist + Prompts + Tasks)
  app.post('/api/ai/generate-project', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const { name, brief, providerConfig } = req.body as {
        name?: string;
        brief?: string;
        providerConfig?: ProviderConfig;
      };

      if (!name?.trim() || !brief?.trim()) {
        res.status(400).json({
          error: 'Vui lòng cung cấp tên dự án và mô tả ngắn (name & brief required).',
        });
        return;
      }

      const systemInstruction =
        'You are a senior Staff Software Architect for FunnelFlow Quota Guard. ' +
        'Output concise, pragmatic bilingual Vietnamese–English software artifacts (prioritize Vietnamese explanation with English technical terms in parentheses). ' +
        'Return strictly valid JSON matching the requested fields.';

      const userPrompt = `Tạo khung khởi tạo cho dự án:
Tên dự án (Name): ${name.trim()}
Mô tả ngắn (Brief): ${brief.trim()}

Yêu cầu JSON trả về gồm:
- prdText: string (Mục tiêu sản phẩm, phạm vi MVP, non-goals, ranh giới module)
- researchNotes: string (Phân tích kỹ thuật, lựa chọn thư viện và rủi ro cần tránh)
- checklistLabels: string[] (4 đầu mục kiểm tra quan trọng nhất để chốt PRD)
- prompts: array of 2 objects { title, content, isProduction } (1 bản đầy đủ, 1 bản Production Prompt siêu súc tích)
- tasks: array of 2 objects { title, targetFiles, modelTier ("Flash" | "Pro / Claude"), prompt } (prompt phải theo chuẩn [Hành động / Action] + [Tệp mục tiêu / Target File] + [Kết quả kỳ vọng / Expected Output])`;

      if (providerConfig?.apiFormat && providerConfig.apiFormat !== 'gemini-builtin') {
        const result = await callThirdPartyText(
          providerConfig,
          systemInstruction,
          userPrompt,
          true
        );
        const parsed = extractJsonObject(result.text);
        res.json({
          ...parsed,
          meta: {
            providerLabel: result.providerLabel,
            modelUsed: result.modelUsed,
            latencyMs: Date.now() - startedAt,
          },
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Chưa tìm thấy GEMINI_API_KEY trên máy chủ. Kiểm tra Settings > Secrets.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: BALANCED_GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prdText: { type: Type.STRING },
              researchNotes: { type: Type.STRING },
              checklistLabels: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              prompts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    isProduction: { type: Type.BOOLEAN },
                  },
                },
              },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    targetFiles: { type: Type.STRING },
                    modelTier: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        ...parsed,
        meta: {
          providerLabel: providerConfig?.label || 'Google Gemini Built-in',
          modelUsed: BALANCED_GEMINI_MODEL,
          latencyMs: Date.now() - startedAt,
        },
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 3. Step 1 Assist: Deepen PRD, Edge-case Risks & Missing Checklist Items
  app.post('/api/ai/step1-assist', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const { projectName, prdText, researchNotes, checklist, providerConfig } =
        req.body as {
          projectName?: string;
          prdText?: string;
          researchNotes?: string;
          checklist?: string[];
          providerConfig?: ProviderConfig;
        };

      const systemInstruction =
        'You are a pragmatic Staff Product Architect. Analyze the PRD and find missing edge cases, security/quota risks, and 2-3 concrete checklist items. Use Vietnamese explanations with English terms in parentheses.';

      const userPrompt = `Dự án: ${projectName ?? 'Untitled'}
PRD hiện tại:
${prdText ?? ''}

Ghi chú nghiên cứu:
${researchNotes ?? ''}

Checklist hiện có:
${(checklist ?? []).join('\n- ')}

Trả về JSON gồm:
- prdAdditions: string (Bổ sung tiêu chí nghiệm thu & ranh giới kỹ thuật chưa có trong PRD)
- riskNotes: string (2-3 rủi ro biên & cách phòng tránh)
- suggestedChecklistItems: string[] (2-3 đầu mục checklist mới không trùng với danh sách trên)`;

      if (providerConfig?.apiFormat && providerConfig.apiFormat !== 'gemini-builtin') {
        const result = await callThirdPartyText(
          providerConfig,
          systemInstruction,
          userPrompt,
          true
        );
        const parsed = extractJsonObject(result.text);
        res.json({
          ...parsed,
          meta: {
            providerLabel: result.providerLabel,
            modelUsed: result.modelUsed,
            latencyMs: Date.now() - startedAt,
          },
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Chưa tìm thấy GEMINI_API_KEY trên máy chủ.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: BALANCED_GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prdAdditions: { type: Type.STRING },
              riskNotes: { type: Type.STRING },
              suggestedChecklistItems: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        ...parsed,
        meta: {
          providerLabel: providerConfig?.label || 'Google Gemini Built-in',
          modelUsed: BALANCED_GEMINI_MODEL,
          latencyMs: Date.now() - startedAt,
        },
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 4. Step 2: Fast System Prompt Compressor (Uses gemini-3.1-flash-lite)
  app.post('/api/ai/compress-prompt', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const { promptText, projectName, providerConfig } = req.body as {
        promptText?: string;
        projectName?: string;
        providerConfig?: ProviderConfig;
      };

      if (!promptText?.trim()) {
        res.status(400).json({
          error: 'Prompt cần nén đang trống (Prompt text required).',
        });
        return;
      }

      const systemInstruction =
        'You are an expert LLM Prompt Compressor. Shrink the given System Prompt by 35-60% fewer tokens while keeping 100% of technical constraints, stack requirements, and edge-case rules intact.';

      const userPrompt = `Dự án: ${projectName ?? ''}
Prompt gốc cần nén:
"""
${promptText.trim()}
"""
Trả về JSON:
- compressedTitle: string (Tên ngắn gọn cho biến thể nén)
- compressedPrompt: string (Prompt sau khi nén, súc tích, chuẩn xác)
- rationale: string (Giải thích ngắn bằng tiếng Việt + thuật ngữ tiếng Anh về phần đã lược bỏ)`;

      if (providerConfig?.apiFormat && providerConfig.apiFormat !== 'gemini-builtin') {
        const result = await callThirdPartyText(
          providerConfig,
          systemInstruction,
          userPrompt,
          true
        );
        const parsed = extractJsonObject(result.text);
        res.json({
          ...parsed,
          meta: {
            providerLabel: result.providerLabel,
            modelUsed: result.modelUsed,
            latencyMs: Date.now() - startedAt,
          },
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Chưa tìm thấy GEMINI_API_KEY trên máy chủ.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: FAST_GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              compressedTitle: { type: Type.STRING },
              compressedPrompt: { type: Type.STRING },
              rationale: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        ...parsed,
        meta: {
          providerLabel: providerConfig?.label || 'Google Gemini Built-in',
          modelUsed: FAST_GEMINI_MODEL,
          latencyMs: Date.now() - startedAt,
        },
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 5. Step 3: Anti-Burnout Scope Rewriter (Uses gemini-3.1-flash-lite)
  app.post('/api/ai/rewrite-scope', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const { taskTitle, targetFiles, rawPrompt, modelTier, providerConfig } =
        req.body as {
          taskTitle?: string;
          targetFiles?: string;
          rawPrompt?: string;
          modelTier?: string;
          providerConfig?: ProviderConfig;
        };

      const systemInstruction =
        'You are an Antigravity Quota Guard assistant. Rewrite vague or under-specified coding prompts into strictly scoped prompts following "[Hành động / Action] + [Tệp mục tiêu / Target File] + [Kết quả kỳ vọng / Expected Output]". Also recommend whether Flash (UI/CSS/small fix) or Pro / Claude (Architecture/DB/multi-file) fits best.';

      const userPrompt = `Tên tác vụ: ${taskTitle ?? '(chưa đặt tên)'}
Tệp mục tiêu hiện có: ${targetFiles ?? '(chưa có)'}
Model Tier đang chọn: ${modelTier ?? 'Flash'}
Prompt gốc: ${rawPrompt ?? '(trống)'}

Trả về JSON:
- scopedPrompt: string (Đủ 3 dòng [Hành động / Action], [Tệp mục tiêu / Target File], [Kết quả kỳ vọng / Expected Output])
- suggestedTargetFiles: string (Đường dẫn tệp cụ thể nếu người dùng bỏ trống, hoặc giữ nguyên)
- recommendedTier: "Flash" | "Pro / Claude"
- explanation: string (1 câu tiếng Việt giải thích vì sao phạm vi này tiết kiệm quota)`;

      if (providerConfig?.apiFormat && providerConfig.apiFormat !== 'gemini-builtin') {
        const result = await callThirdPartyText(
          providerConfig,
          systemInstruction,
          userPrompt,
          true
        );
        const parsed = extractJsonObject(result.text);
        res.json({
          ...parsed,
          meta: {
            providerLabel: result.providerLabel,
            modelUsed: result.modelUsed,
            latencyMs: Date.now() - startedAt,
          },
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Chưa tìm thấy GEMINI_API_KEY trên máy chủ.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: FAST_GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scopedPrompt: { type: Type.STRING },
              suggestedTargetFiles: { type: Type.STRING },
              recommendedTier: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        ...parsed,
        meta: {
          providerLabel: providerConfig?.label || 'Google Gemini Built-in',
          modelUsed: FAST_GEMINI_MODEL,
          latencyMs: Date.now() - startedAt,
        },
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // 6. Smart Handoff Brief Synthesizer (Uses gemini-4-hydrogen)
  app.post('/api/ai/handoff-brief', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const {
        accountLabel,
        provider,
        quotaMode,
        projectName,
        funnelStep,
        nextTaskTitle,
        targetFiles,
        remainingTime,
        sessionNote,
        providerConfig,
      } = req.body as Record<string, unknown> & {
        providerConfig?: ProviderConfig;
      };

      const systemInstruction =
        'Synthesize a crisp, ready-to-paste developer handoff brief in bilingual Vietnamese-English (prioritize Vietnamese with English technical terms in parentheses) under 140 words. Include exact next action, target files, and quota window advice.';

      const userPrompt = `Account: ${accountLabel} (${provider} · ${quotaMode})
Project: ${projectName} · Step ${funnelStep}/3
Quota Remaining: ${remainingTime}
Next Task: ${nextTaskTitle}
Target Files: ${targetFiles}
Session Note: ${sessionNote || 'None'}

Trả về JSON: { "brief": string }`;

      if (providerConfig?.apiFormat && providerConfig.apiFormat !== 'gemini-builtin') {
        const result = await callThirdPartyText(
          providerConfig,
          systemInstruction,
          userPrompt,
          true
        );
        const parsed = extractJsonObject(result.text);
        res.json({
          ...parsed,
          meta: {
            providerLabel: result.providerLabel,
            modelUsed: result.modelUsed,
            latencyMs: Date.now() - startedAt,
          },
        });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Chưa tìm thấy GEMINI_API_KEY trên máy chủ.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: BALANCED_GEMINI_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brief: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        ...parsed,
        meta: {
          providerLabel: providerConfig?.label || 'Google Gemini Built-in',
          modelUsed: BALANCED_GEMINI_MODEL,
          latencyMs: Date.now() - startedAt,
        },
      });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FunnelFlow Quota Guard server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
