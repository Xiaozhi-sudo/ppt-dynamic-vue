import type { PptStepKey } from "./types";

export interface PptStep {
  key: PptStepKey;
  label: string;
  message: string;
}

export const pptSteps: PptStep[] = [
  {
    key: "analyzing",
    label: "分析主题",
    message: "正在分析主题和汇报目标",
  },
  {
    key: "outline",
    label: "生成大纲",
    message: "正在生成演示文稿结构",
  },
  {
    key: "matching_template",
    label: "匹配模板",
    message: "正在匹配合适的设计模板",
  },
  {
    key: "filling_slides",
    label: "填充页面",
    message: "正在填充页面内容",
  },
  {
    key: "rendering_preview",
    label: "渲染预览",
    message: "正在生成页面预览",
  },
  {
    key: "exporting",
    label: "导出文件",
    message: "正在导出 PPTX 文件",
  },
  {
    key: "completed",
    label: "生成完成",
    message: "PPT 已生成完成",
  },
];

export const pptStepLabels: Record<PptStepKey, string> = Object.fromEntries(
  pptSteps.map((step) => [step.key, step.label]),
) as Record<PptStepKey, string>;

export const pptStepMessages: Record<PptStepKey, string> = Object.fromEntries(
  pptSteps.map((step) => [step.key, step.message]),
) as Record<PptStepKey, string>;
