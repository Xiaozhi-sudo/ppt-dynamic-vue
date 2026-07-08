import { describe, expect, it } from "vitest";
import { generateDeckContent } from "./generator";
import { createSlideFillFrames } from "./animation";
import { renderDeck } from "./renderer";
import { getTemplateById } from "./templates";

describe("createSlideFillFrames", () => {
  it("starts with template-only slides before any text is filled", () => {
    const template = getTemplateById("business-blue");
    if (!template) throw new Error("template missing");

    const slides = renderDeck(generateDeckContent("智能制造"), template);
    const frames = createSlideFillFrames(slides);

    expect(frames[0].animation.phase).toBe("template");
    expect(frames[0].slides).toHaveLength(6);
    expect(frames[0].slides.every((slide) => slide.title === "")).toBe(true);
    expect(frames[0].slides.every((slide) => slide.bullets.length === 0)).toBe(true);
    expect(frames[0].slides.every((slide) => slide.status === "pending")).toBe(true);
  });

  it("fills title, subtitle, and bullets incrementally for each slide", () => {
    const template = getTemplateById("tech-dark");
    if (!template) throw new Error("template missing");

    const finalSlides = renderDeck(generateDeckContent("智能制造"), template);
    const frames = createSlideFillFrames(finalSlides);

    const firstTitleFrame = frames.find(
      (frame) => frame.animation.slideIndex === 0 && frame.animation.field === "title",
    );
    const firstBulletFrame = frames.find(
      (frame) => frame.animation.slideIndex === 1 && frame.animation.field === "bullets",
    );
    const lastFrame = frames.at(-1);

    expect(firstTitleFrame?.slides[0].title).toBe(finalSlides[0].title);
    expect(firstTitleFrame?.slides[0].subtitle).toBe("");
    expect(firstBulletFrame?.slides[1].bullets).toEqual([finalSlides[1].bullets[0]]);
    expect(lastFrame?.animation.phase).toBe("ready");
    expect(lastFrame?.slides).toEqual(finalSlides);
  });
});
