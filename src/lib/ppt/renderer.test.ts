import { describe, expect, it } from "vitest";
import { generateDeckContent } from "./generator";
import { renderDeck } from "./renderer";
import { getTemplateById } from "./templates";

describe("renderDeck", () => {
  it("merges generated content with a template", () => {
    const template = getTemplateById("business-blue");
    if (!template) throw new Error("template missing");

    const rendered = renderDeck(generateDeckContent("行业研究"), template);

    expect(rendered).toHaveLength(6);
    expect(rendered[0].templateId).toBe("business-blue");
    expect(rendered[0].title).toContain("行业研究");
    expect(rendered[0].style.background).toBe(template.layouts.cover.background);
  });

  it("assigns slide indexes, ready status, and matching layouts", () => {
    const template = getTemplateById("tech-dark");
    if (!template) throw new Error("template missing");

    const rendered = renderDeck(generateDeckContent("AI 产品规划"), template);

    expect(rendered.map((slide) => slide.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rendered.every((slide) => slide.status === "ready")).toBe(true);
    expect(rendered[1].style.layout).toEqual(template.layouts.agenda);
    expect(rendered[2].style.layout).toEqual(template.layouts.content);
  });

  it("copies bullet arrays so rendered slides cannot mutate generated content", () => {
    const template = getTemplateById("fresh-green");
    if (!template) throw new Error("template missing");

    const deck = generateDeckContent("客户增长策略");
    const rendered = renderDeck(deck, template);
    rendered[1].bullets.push("污染目录");

    expect(deck.slides[1].bullets).toEqual(["背景与趋势", "核心洞察", "行动建议"]);
  });

  it("copies template style objects so rendered slides cannot mutate templates", () => {
    const template = getTemplateById("business-blue");
    if (!template) throw new Error("template missing");

    const originalPrimary = template.colors.primary;
    const originalTitleX = template.layouts.cover.titleBox.x;
    const originalAccentRegionX = template.layouts.cover.accentElements[0].region.x;

    const rendered = renderDeck(generateDeckContent("市场进入策略"), template);
    rendered[0].style.colors.primary = "#000000";
    rendered[0].style.layout.titleBox.x = 0.99;
    rendered[0].style.layout.accentElements[0].region.x = 0.01;

    expect(template.colors.primary).toBe(originalPrimary);
    expect(template.layouts.cover.titleBox.x).toBe(originalTitleX);
    expect(template.layouts.cover.accentElements[0].region.x).toBe(originalAccentRegionX);
  });
});
