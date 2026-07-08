import { describe, expect, it } from "vitest";
import { generateDeckContent } from "./generator";

describe("generateDeckContent", () => {
  it("creates a six-slide deck from a topic", () => {
    const deck = generateDeckContent("新能源汽车市场分析");

    expect(deck.title).toContain("新能源汽车市场分析");
    expect(deck.subtitle).toBe("易策 AI 自动生成演示文稿");
    expect(deck.sections).toEqual(["背景与趋势", "核心洞察", "行动建议"]);
    expect(deck.slides).toHaveLength(6);
    expect(deck.slides.map((slide) => slide.layoutType)).toEqual([
      "cover",
      "agenda",
      "content",
      "content",
      "content",
      "summary",
    ]);
    expect(deck.slides.every((slide) => Array.isArray(slide.bullets))).toBe(
      true,
    );
  });

  it("uses the trimmed topic in the title", () => {
    const deck = generateDeckContent("  新能源汽车市场分析  ");

    expect(deck.title).toBe("新能源汽车市场分析 PPT");
  });

  it("uses stable slide ids and three bullets for content-heavy slides", () => {
    const deck = generateDeckContent("新能源汽车市场分析");

    expect(deck.slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-2",
      "slide-3",
      "slide-4",
      "slide-5",
      "slide-6",
    ]);
    expect(deck.slides.slice(2).every((slide) => slide.bullets.length === 3))
      .toBe(true);
  });

  it("uses a deterministic default createdAt and accepts an override", () => {
    expect(generateDeckContent("新能源汽车市场分析").createdAt).toBe(
      "2026-06-26T00:00:00.000Z",
    );
    expect(
      generateDeckContent("新能源汽车市场分析", {
        createdAt: "2026-07-01T08:30:00.000Z",
      }).createdAt,
    ).toBe("2026-07-01T08:30:00.000Z");
  });

  it("returns deeply equal decks for repeated calls with the same topic", () => {
    expect(generateDeckContent("新能源汽车市场分析")).toEqual(
      generateDeckContent("新能源汽车市场分析"),
    );
  });

  it("does not share mutable section arrays between generated decks", () => {
    const firstDeck = generateDeckContent("新能源汽车市场分析");
    const secondDeck = generateDeckContent("新能源汽车市场分析");

    firstDeck.sections.push("污染章节");
    firstDeck.slides[1].bullets.push("污染目录");

    expect(secondDeck.sections).toEqual(["背景与趋势", "核心洞察", "行动建议"]);
    expect(secondDeck.slides[1].bullets).toEqual([
      "背景与趋势",
      "核心洞察",
      "行动建议",
    ]);
    expect(generateDeckContent("新能源汽车市场分析").sections).toEqual([
      "背景与趋势",
      "核心洞察",
      "行动建议",
    ]);
    expect(generateDeckContent("新能源汽车市场分析").slides[1].bullets).toEqual([
      "背景与趋势",
      "核心洞察",
      "行动建议",
    ]);
  });

  it("rejects an empty topic", () => {
    expect(() => generateDeckContent("   ")).toThrow("主题不能为空");
  });
});
