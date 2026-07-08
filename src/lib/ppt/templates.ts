import type { PptTemplate, SlideLayout, SlideLayoutType } from "./types";

const layoutTypes: SlideLayoutType[] = [
  "cover",
  "agenda",
  "section",
  "content",
  "summary",
];

const createLayouts = (colors: PptTemplate["colors"]): Record<SlideLayoutType, SlideLayout> => ({
  cover: {
    type: "cover",
    background: colors.background,
    titleBox: { x: 0.1, y: 0.24, w: 0.72, h: 0.18 },
    subtitleBox: { x: 0.1, y: 0.46, w: 0.58, h: 0.12 },
    accentElements: [
      {
        id: "cover-accent",
        type: "rect",
        region: { x: 0.82, y: 0, w: 0.18, h: 1 },
        color: colors.primary,
        opacity: 0.12,
      },
    ],
  },
  agenda: {
    type: "agenda",
    background: colors.surface,
    titleBox: { x: 0.08, y: 0.08, w: 0.72, h: 0.12 },
    bodyBox: { x: 0.12, y: 0.25, w: 0.76, h: 0.58 },
    accentElements: [
      {
        id: "agenda-rule",
        type: "line",
        region: { x: 0.08, y: 0.22, w: 0.84, h: 0.01 },
        color: colors.accent,
      },
    ],
  },
  section: {
    type: "section",
    background: colors.primary,
    titleBox: { x: 0.14, y: 0.36, w: 0.72, h: 0.16 },
    subtitleBox: { x: 0.14, y: 0.56, w: 0.62, h: 0.1 },
    accentElements: [
      {
        id: "section-block",
        type: "rect",
        region: { x: 0.08, y: 0.34, w: 0.025, h: 0.26 },
        color: colors.accent,
      },
    ],
  },
  content: {
    type: "content",
    background: colors.background,
    titleBox: { x: 0.08, y: 0.07, w: 0.78, h: 0.1 },
    bodyBox: { x: 0.08, y: 0.22, w: 0.84, h: 0.62 },
    accentElements: [
      {
        id: "content-tag",
        type: "rect",
        region: { x: 0.08, y: 0.18, w: 0.16, h: 0.012 },
        color: colors.secondary,
      },
    ],
  },
  summary: {
    type: "summary",
    background: colors.surface,
    titleBox: { x: 0.1, y: 0.1, w: 0.72, h: 0.12 },
    bodyBox: { x: 0.12, y: 0.28, w: 0.76, h: 0.48 },
    accentElements: [
      {
        id: "summary-circle",
        type: "circle",
        region: { x: 0.78, y: 0.1, w: 0.12, h: 0.12 },
        color: colors.accent,
        opacity: 0.18,
      },
    ],
  },
});

export const templates: PptTemplate[] = [
  {
    id: "business-blue",
    name: "商务蓝",
    description: "Clean corporate template for strategy, operations, and business reviews.",
    theme: "business",
    colors: {
      primary: "#1D4ED8",
      secondary: "#38BDF8",
      accent: "#F59E0B",
      background: "#F8FAFC",
      surface: "#FFFFFF",
      text: "#0F172A",
      mutedText: "#475569",
    },
    fontFamily: "Arial",
    layouts: createLayouts({
      primary: "#1D4ED8",
      secondary: "#38BDF8",
      accent: "#F59E0B",
      background: "#F8FAFC",
      surface: "#FFFFFF",
      text: "#0F172A",
      mutedText: "#475569",
    }),
  },
  {
    id: "tech-dark",
    name: "科技黑",
    description: "High-contrast dark template for product, engineering, and AI topics.",
    theme: "technology",
    colors: {
      primary: "#111827",
      secondary: "#22D3EE",
      accent: "#A78BFA",
      background: "#020617",
      surface: "#0F172A",
      text: "#F8FAFC",
      mutedText: "#CBD5E1",
    },
    fontFamily: "Arial",
    layouts: createLayouts({
      primary: "#111827",
      secondary: "#22D3EE",
      accent: "#A78BFA",
      background: "#020617",
      surface: "#0F172A",
      text: "#F8FAFC",
      mutedText: "#CBD5E1",
    }),
  },
  {
    id: "fresh-green",
    name: "清新绿",
    description: "Fresh, readable template for education, reports, and planning decks.",
    theme: "fresh",
    colors: {
      primary: "#15803D",
      secondary: "#14B8A6",
      accent: "#F97316",
      background: "#F7FEE7",
      surface: "#FFFFFF",
      text: "#14532D",
      mutedText: "#4B5563",
    },
    fontFamily: "Arial",
    layouts: createLayouts({
      primary: "#15803D",
      secondary: "#14B8A6",
      accent: "#F97316",
      background: "#F7FEE7",
      surface: "#FFFFFF",
      text: "#14532D",
      mutedText: "#4B5563",
    }),
  },
];

export const getTemplateById = (id: string): PptTemplate | undefined =>
  templates.find((template) => template.id === id);

export { layoutTypes };
