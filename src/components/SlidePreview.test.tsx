import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { generateDeckContent } from "../lib/ppt/generator";
import { renderDeck } from "../lib/ppt/renderer";
import { getTemplateById } from "../lib/ppt/templates";
import type { PptFillAnimation } from "../lib/ppt/types";
import { SlidePreview } from "./SlidePreview";

const createSlide = () => {
  const template = getTemplateById("business-blue");
  if (!template) throw new Error("template missing");

  return renderDeck(generateDeckContent("智能制造"), template)[1];
};

describe("SlidePreview", () => {
  it("renders the active generation cue on the large preview canvas", () => {
    const slide = {
      ...createSlide(),
      bullets: ["第一条要点"],
      status: "filling" as const,
    };
    const animation: PptFillAnimation = {
      phase: "bullets",
      field: "bullets",
      slideIndex: slide.index,
      bulletIndex: 0,
    };

    const markup = renderToStaticMarkup(
      <SlidePreview animation={animation} mode="large" slide={slide} />,
    );

    expect(markup).toContain("slide-generation-cue");
    expect(markup).toContain("正在填充第 2 页要点 1");
    expect(markup).toContain('data-animation-field="bullets"');
    expect(markup).toContain('data-active-bullet="true"');
  });

  it("keeps thumbnails as progress indicators instead of playing field animations", () => {
    const slide = {
      ...createSlide(),
      bullets: ["第一条要点"],
      status: "filling" as const,
    };
    const animation: PptFillAnimation = {
      phase: "bullets",
      field: "bullets",
      slideIndex: slide.index,
      bulletIndex: 0,
    };

    const markup = renderToStaticMarkup(
      <SlidePreview animation={animation} mode="thumbnail" slide={slide} />,
    );

    expect(markup).not.toContain("slide-generation-cue");
    expect(markup).not.toContain("data-active-bullet");
    expect(markup).not.toContain("is-filling");
  });
});
