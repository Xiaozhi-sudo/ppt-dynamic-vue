import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedDeck, GeneratedSlide, SlideLayoutType } from "./types";
import { generateDeckContent } from "./generator";

interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const defaultBaseUrl = "https://api.deepseek.com";
const defaultModel = "deepseek-v4-flash";
const llmInformationPath = path.join(process.cwd(), "llm-information.md");

const slideLayoutTypes = new Set<SlideLayoutType>([
  "cover",
  "agenda",
  "section",
  "content",
  "summary",
]);

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

export const parseLlmInformation = (content: string): LlmConfig => {
  const deepSeekSection = content.split(/另外一个账号：/u)[0] ?? content;
  const apiKey = deepSeekSection.match(/sk-[A-Za-z0-9]+/)?.[0];
  const baseUrl = deepSeekSection.match(/base_url \(OpenAI\)\s*\n(https?:\/\/\S+)/u)?.[1];
  const model = deepSeekSection.match(/model\*\s*\n([A-Za-z0-9_.-]+)/u)?.[1];

  if (!apiKey) {
    throw new Error("llm-information.md 中未找到 DeepSeek API Key");
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(baseUrl ?? defaultBaseUrl),
    model: model ?? defaultModel,
  };
};

const loadLlmConfig = async (): Promise<LlmConfig> => {
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: normalizeBaseUrl(process.env.DEEPSEEK_BASE_URL ?? defaultBaseUrl),
      model: process.env.DEEPSEEK_MODEL ?? defaultModel,
    };
  }

  const llmInformation = await readFile(llmInformationPath, "utf8");
  return parseLlmInformation(llmInformation);
};

const extractJsonObject = (content: string): unknown => {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/u);
  const candidate = fencedMatch?.[1] ?? content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("大模型未返回 JSON 对象");
  }

  return JSON.parse(candidate.slice(start, end + 1));
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 4)
    : [];

const normalizeSlide = (
  slide: unknown,
  index: number,
  fallback: GeneratedSlide,
): GeneratedSlide => {
  const source = slide && typeof slide === "object" ? slide as Record<string, unknown> : {};
  const layoutType = typeof source.layoutType === "string" &&
    slideLayoutTypes.has(source.layoutType as SlideLayoutType)
    ? source.layoutType as SlideLayoutType
    : fallback.layoutType;
  const bullets = asStringArray(source.bullets);

  return {
    id: `slide-${index + 1}`,
    layoutType,
    title: typeof source.title === "string" && source.title.trim()
      ? source.title.trim()
      : fallback.title,
    subtitle: typeof source.subtitle === "string" && source.subtitle.trim()
      ? source.subtitle.trim()
      : fallback.subtitle,
    bullets: bullets.length > 0 || layoutType === "cover" ? bullets : [...fallback.bullets],
    notes: typeof source.notes === "string" && source.notes.trim()
      ? source.notes.trim()
      : fallback.notes,
  };
};

const normalizeDeck = (payload: unknown, topic: string): GeneratedDeck => {
  const fallback = generateDeckContent(topic, {
    createdAt: new Date().toISOString(),
  });
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const sourceSlides = Array.isArray(source.slides) ? source.slides : [];
  const slides = fallback.slides.map((fallbackSlide, index) =>
    normalizeSlide(sourceSlides[index], index, fallbackSlide),
  );
  const sections = asStringArray(source.sections);

  return {
    id: fallback.id,
    title: typeof source.title === "string" && source.title.trim()
      ? source.title.trim()
      : fallback.title,
    subtitle: typeof source.subtitle === "string" && source.subtitle.trim()
      ? source.subtitle.trim()
      : fallback.subtitle,
    sections: sections.length > 0 ? sections.slice(0, 3) : [...fallback.sections],
    slides,
    speakerNotes: slides.map((slide) => `${slide.id}: ${slide.notes ?? ""}`).join("\n"),
    createdAt: fallback.createdAt,
  };
};

const buildPrompt = (topic: string): string => `
请根据主题生成一份 6 页中文 PPT 的结构化内容。

主题：${topic}

只返回 JSON 对象，不要返回 Markdown，不要解释。JSON 结构必须是：
{
  "title": "...",
  "subtitle": "易策 AI 自动生成演示文稿",
  "sections": ["背景与趋势", "核心洞察", "行动建议"],
  "slides": [
    {"layoutType":"cover","title":"...","subtitle":"...","bullets":[],"notes":"..."},
    {"layoutType":"agenda","title":"目录","subtitle":"本次汇报结构","bullets":["...","...","..."],"notes":"..."},
    {"layoutType":"content","title":"背景与趋势","subtitle":"...","bullets":["...","...","..."],"notes":"..."},
    {"layoutType":"content","title":"核心洞察","subtitle":"...","bullets":["...","...","..."],"notes":"..."},
    {"layoutType":"content","title":"行动建议","subtitle":"...","bullets":["...","...","..."],"notes":"..."},
    {"layoutType":"summary","title":"总结","subtitle":"...","bullets":["...","...","..."],"notes":"..."}
  ]
}

要求：每条 bullet 不超过 28 个中文字；内容要具体、适合商业汇报。
`.trim();

export const generateDeckContentWithLlm = async (topic: string): Promise<GeneratedDeck> => {
  const normalizedTopic = topic.trim();
  if (!normalizedTopic) {
    throw new Error("主题不能为空");
  }

  const config = await loadLlmConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "你是易策 AI 的 PPT 内容策划助手，擅长生成结构清晰的中文商业演示文稿。",
        },
        {
          role: "user",
          content: buildPrompt(normalizedTopic),
        },
      ],
      temperature: 0.4,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`大模型调用失败: ${response.status} ${errorBody.slice(0, 160)}`);
  }

  const data = await response.json() as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("大模型响应为空");
  }

  return normalizeDeck(extractJsonObject(content), normalizedTopic);
};
