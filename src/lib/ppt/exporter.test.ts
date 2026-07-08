import { existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportPptx } from "./exporter";
import { generateDeckContent } from "./generator";
import { renderDeck } from "./renderer";
import { getTemplateById } from "./templates";

describe("exportPptx", () => {
  it("writes a non-empty pptx file", async () => {
    const template = getTemplateById("business-blue");
    if (!template) throw new Error("template missing");

    const slides = renderDeck(generateDeckContent("测试主题"), template);
    const filePath = await exportPptx({ slides, template, jobId: "test-job" });

    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(1000);

    const zipListing = execFileSync("unzip", ["-l", filePath], { encoding: "utf8" });
    expect(zipListing).toContain("[Content_Types].xml");
    expect(zipListing).toContain("ppt/presentation.xml");
    expect(zipListing).toContain("ppt/slides/slide1.xml");
    expect(zipListing).toContain("ppt/slides/slide6.xml");
  });

  it("rejects unsafe jobId values without writing outside the output directory", async () => {
    const template = getTemplateById("business-blue");
    if (!template) throw new Error("template missing");

    const slides = renderDeck(generateDeckContent("测试主题"), template);
    const outsidePath = path.join(process.cwd(), "outside.pptx");

    await expect(
      exportPptx({ slides, template, jobId: "../../outside" }),
    ).rejects.toThrow("jobId 包含非法字符");
    expect(existsSync(outsidePath)).toBe(false);
  });
});
