import type { GeneratedDeck } from "./types";

const deckSubtitle = "易策 AI 自动生成演示文稿";
const deckSections = ["背景与趋势", "核心洞察", "行动建议"];
const defaultCreatedAt = "2026-06-26T00:00:00.000Z";

interface GenerateDeckContentOptions {
  createdAt?: string;
}

export function generateDeckContent(
  topic: string,
  options: GenerateDeckContentOptions = {},
): GeneratedDeck {
  const normalizedTopic = topic.trim();

  if (!normalizedTopic) {
    throw new Error("主题不能为空");
  }

  const slides = [
    {
      id: "slide-1",
      layoutType: "cover",
      title: `${normalizedTopic} PPT`,
      subtitle: deckSubtitle,
      bullets: [],
      notes: `开场说明 ${normalizedTopic} 的汇报目标和主要结论。`,
    },
    {
      id: "slide-2",
      layoutType: "agenda",
      title: "目录",
      subtitle: "本次汇报结构",
      bullets: [...deckSections],
      notes: "快速说明三个部分的逻辑顺序。",
    },
    {
      id: "slide-3",
      layoutType: "content",
      title: "背景与趋势",
      subtitle: normalizedTopic,
      bullets: [
        `${normalizedTopic} 正处于需求升级与结构调整并行阶段。`,
        "政策、技术和用户预期共同推动市场节奏变化。",
        "竞争焦点从规模扩张转向效率、体验和可持续增长。",
      ],
      notes: "强调外部环境变化带来的机会窗口。",
    },
    {
      id: "slide-4",
      layoutType: "content",
      title: "核心洞察",
      subtitle: normalizedTopic,
      bullets: [
        "高价值用户更关注可靠性、服务体验和长期成本。",
        "头部参与者通过产品组合和渠道能力建立差异化。",
        "数据化运营将成为识别增长机会和控制风险的关键。",
      ],
      notes: "聚焦可用于决策的三条关键判断。",
    },
    {
      id: "slide-5",
      layoutType: "content",
      title: "行动建议",
      subtitle: normalizedTopic,
      bullets: [
        "优先锁定高潜细分场景，形成清晰的价值主张。",
        "建立指标看板，持续跟踪需求、转化和留存表现。",
        "通过试点项目验证方案，再逐步扩大资源投入。",
      ],
      notes: "将洞察落到可执行的下一步动作。",
    },
    {
      id: "slide-6",
      layoutType: "summary",
      title: "总结",
      subtitle: normalizedTopic,
      bullets: [
        `${normalizedTopic} 的机会来自趋势判断与执行效率的结合。`,
        "短期应聚焦重点场景，中期完善能力闭环。",
        "持续复盘数据表现，推动策略迭代和组织协同。",
      ],
      notes: "收束结论，并引导后续讨论。",
    },
  ] satisfies GeneratedDeck["slides"];

  return {
    id: "deck-1",
    title: `${normalizedTopic} PPT`,
    subtitle: deckSubtitle,
    sections: [...deckSections],
    slides,
    speakerNotes: slides
      .map((slide) => `${slide.id}: ${slide.notes ?? ""}`)
      .join("\n"),
    createdAt: options.createdAt ?? defaultCreatedAt,
  };
}
