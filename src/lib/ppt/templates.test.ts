import { describe, expect, it } from "vitest";
import { getTemplateById, templates } from "./templates";
import { pptStepKeys } from "./types";
import type {
  GeneratedDeck,
  GeneratedSlide,
  PptJob,
  PptJobEvent,
  PptStepKey,
  RenderedSlide,
} from "./types";

const expectedSteps: PptStepKey[] = [
  "analyzing",
  "outline",
  "matching_template",
  "filling_slides",
  "rendering_preview",
  "exporting",
  "completed",
];

const generatedSlide = {
  id: "slide-1",
  layoutType: "content",
  title: "Market Overview",
  subtitle: "Q2 signals",
  bullets: ["Demand is improving", "Pipeline quality is stable"],
  notes: "Emphasize regional mix.",
} satisfies GeneratedSlide;

const generatedDeck = {
  id: "deck-1",
  title: "Quarterly Review",
  subtitle: "Q2 2026",
  sections: ["Overview", "Plan"],
  slides: [generatedSlide],
  speakerNotes: "Keep the opening concise.",
  createdAt: "2026-06-26T00:00:00.000Z",
} satisfies GeneratedDeck;

const renderedSlide = {
  id: "rendered-1",
  index: 0,
  layoutType: "content",
  templateId: "business-blue",
  title: generatedSlide.title,
  subtitle: generatedSlide.subtitle,
  bullets: generatedSlide.bullets,
  notes: generatedSlide.notes,
  style: {
    colors: templates[0].colors,
    fontFamily: templates[0].fontFamily,
    layout: templates[0].layouts.content,
    background: templates[0].layouts.content.background,
  },
  status: "ready",
} satisfies RenderedSlide;

const pptJob = {
  id: "job-1",
  topic: "Quarterly Review",
  templateId: "business-blue",
  status: "running",
  currentStep: "rendering_preview",
  progress: 70,
  slides: [renderedSlide],
  downloadPath: "/tmp/deck.pptx",
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:01:00.000Z",
} satisfies PptJob;

const pptJobEvent = {
  type: "progress",
  jobId: pptJob.id,
  step: "rendering_preview",
  message: "Rendering preview slides",
  progress: pptJob.progress,
  status: pptJob.status,
  slides: [renderedSlide],
} satisfies PptJobEvent;

describe("templates", () => {
  it("exposes three built-in templates", () => {
    expect(templates.map((template) => template.id)).toEqual([
      "business-blue",
      "tech-dark",
      "fresh-green",
    ]);
  });

  it("provides all required layout types for every template", () => {
    for (const template of templates) {
      expect(Object.keys(template.layouts).sort()).toEqual([
        "agenda",
        "content",
        "cover",
        "section",
        "summary",
      ]);
    }
  });

  it("finds a template by id", () => {
    expect(getTemplateById("business-blue")?.name).toBe("商务蓝");
    expect(getTemplateById("missing")).toBeUndefined();
  });

  it("uses the seven-step PPT job workflow", () => {
    expect(pptStepKeys).toEqual([
      "analyzing",
      "outline",
      "matching_template",
      "filling_slides",
      "rendering_preview",
      "exporting",
      "completed",
    ]);
    expect(expectedSteps).toEqual(pptStepKeys);
  });

  it("accepts design-compatible deck, preview, job, and SSE payloads", () => {
    expect(generatedDeck.slides[0].bullets).toEqual(generatedSlide.bullets);
    expect(renderedSlide.style.layout.type).toBe("content");
    expect(pptJob.currentStep).toBe("rendering_preview");
    expect(pptJobEvent.slides?.[0].templateId).toBe("business-blue");
  });
});
