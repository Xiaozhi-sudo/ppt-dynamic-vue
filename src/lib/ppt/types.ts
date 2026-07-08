export type SlideLayoutType =
  | "cover"
  | "agenda"
  | "section"
  | "content"
  | "summary";

export interface BoxRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AccentElement {
  id: string;
  type: "line" | "rect" | "circle";
  region: BoxRegion;
  color: string;
  opacity?: number;
}

export interface SlideLayout {
  type: SlideLayoutType;
  background: string;
  titleBox: BoxRegion;
  subtitleBox?: BoxRegion;
  bodyBox?: BoxRegion;
  accentElements: AccentElement[];
}

export interface PptTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
}

export interface PptTemplate {
  id: string;
  name: string;
  description: string;
  theme: string;
  colors: PptTheme;
  fontFamily: string;
  layouts: Record<SlideLayoutType, SlideLayout>;
}

export interface GeneratedSlide {
  id: string;
  layoutType: SlideLayoutType;
  title: string;
  subtitle?: string;
  bullets: string[];
  notes?: string;
}

export interface GeneratedDeck {
  id: string;
  title: string;
  subtitle?: string;
  sections: string[];
  slides: GeneratedSlide[];
  speakerNotes?: string;
  createdAt: string;
}

export type RenderedSlideStatus = "pending" | "filling" | "ready" | "failed";

export interface RenderedSlideStyle {
  colors: PptTheme;
  fontFamily: string;
  layout: SlideLayout;
  background: string;
}

export interface RenderedSlide {
  id: string;
  index: number;
  layoutType: SlideLayoutType;
  templateId: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  notes?: string;
  style: RenderedSlideStyle;
  status: RenderedSlideStatus;
}

export const pptStepKeys = [
  "analyzing",
  "outline",
  "matching_template",
  "filling_slides",
  "rendering_preview",
  "exporting",
  "completed",
] as const;

export type PptStepKey = (typeof pptStepKeys)[number];

export type PptJobStatus = "queued" | "running" | "completed" | "failed";

export interface PptJob {
  id: string;
  topic: string;
  templateId: string;
  status: PptJobStatus;
  currentStep: PptStepKey;
  progress: number;
  slides: RenderedSlide[];
  downloadPath?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type PptJobEventType =
  | "status"
  | "progress"
  | "slides"
  | "completed"
  | "error";

export interface PptFillAnimation {
  phase: "template" | "title" | "subtitle" | "bullets" | "ready";
  slideIndex: number;
  field?: "template" | "title" | "subtitle" | "bullets" | "slide";
  bulletIndex?: number;
}

export interface PptJobEvent {
  type: PptJobEventType;
  jobId: string;
  step: PptStepKey;
  message: string;
  progress: number;
  status: PptJobStatus;
  slides?: RenderedSlide[];
  animation?: PptFillAnimation;
  error?: string;
}
