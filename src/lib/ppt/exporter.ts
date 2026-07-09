import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import type { AccentElement, BoxRegion, PptTemplate, RenderedSlide } from "./types";

const outputDir = path.join(process.cwd(), ".generated", "pptx");
const slideWidth = 13.333;
const slideHeight = 7.5;
const validJobIdPattern = /^[A-Za-z0-9_-]+$/;

interface ExportPptxOptions {
  slides: RenderedSlide[];
  template: PptTemplate;
  jobId: string;
}

const toSafeHex = (color: string): string => {
  const normalized = color.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : "FFFFFF";
};

const toTransparency = (opacity?: number): number | undefined => {
  if (opacity === undefined) return undefined;
  const clampedOpacity = Math.min(1, Math.max(0, opacity));
  return Math.round((1 - clampedOpacity) * 100);
};

const toPosition = (region: BoxRegion) => ({
  x: region.x * slideWidth,
  y: region.y * slideHeight,
  w: region.w * slideWidth,
  h: region.h * slideHeight,
});

const addAccentElement = (
  pptx: PptxGenJS,
  slide: PptxGenJS.Slide,
  accentElement: AccentElement,
) => {
  const position = toPosition(accentElement.region);
  const color = toSafeHex(accentElement.color);
  const transparency = toTransparency(accentElement.opacity);

  if (accentElement.type === "line") {
    slide.addShape(pptx.ShapeType.line, {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      line: { color, width: 1.5, transparency },
    });
    return;
  }

  slide.addShape(
    accentElement.type === "circle" ? pptx.ShapeType.ellipse : pptx.ShapeType.rect,
    {
      ...position,
      fill: { color, transparency },
      line: { color, transparency },
    },
  );
};

export async function exportPptx({
  slides,
  template,
  jobId,
}: ExportPptxOptions): Promise<string> {
  if (!validJobIdPattern.test(jobId)) {
    throw new Error("jobId 包含非法字符");
  }

  await mkdir(outputDir, { recursive: true });

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Doubao PPT";
  pptx.subject = template.name;
  pptx.title = `${template.name} ${jobId}`;
  pptx.theme = {
    headFontFace: template.fontFamily,
    bodyFontFace: template.fontFamily,
  };

  for (const renderedSlide of slides) {
    const pptSlide = pptx.addSlide();
    const { colors, fontFamily, layout } = renderedSlide.style;
    const background = renderedSlide.style.background || layout.background;
    const titlePosition = toPosition(layout.titleBox);

    pptSlide.background = { color: toSafeHex(background) };

    for (const accentElement of layout.accentElements) {
      addAccentElement(pptx, pptSlide, accentElement);
    }

    pptSlide.addText(renderedSlide.title, {
      ...titlePosition,
      fontFace: fontFamily,
      fontSize: renderedSlide.layoutType === "cover" ? 34 : 26,
      bold: true,
      color: toSafeHex(colors.text),
      fit: "shrink",
      margin: 0,
      breakLine: false,
    });

    if (renderedSlide.subtitle && layout.subtitleBox) {
      pptSlide.addText(renderedSlide.subtitle, {
        ...toPosition(layout.subtitleBox),
        fontFace: fontFamily,
        fontSize: renderedSlide.layoutType === "cover" ? 18 : 13,
        color: toSafeHex(colors.mutedText),
        fit: "shrink",
        margin: 0,
      });
    }

    if (renderedSlide.bullets.length > 0 && layout.bodyBox) {
      pptSlide.addText(renderedSlide.bullets.map((bullet) => `• ${bullet}`).join("\n"), {
        ...toPosition(layout.bodyBox),
        fontFace: fontFamily,
        fontSize: 16,
        color: toSafeHex(colors.text),
        fit: "shrink",
        margin: [4, 8, 4, 8],
        breakLine: false,
        paraSpaceAfter: 8,
      });
    }

    if (renderedSlide.notes) {
      pptSlide.addNotes(renderedSlide.notes);
    }
  }

  const filePath = path.join(outputDir, `${jobId}.pptx`);
  const content = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  await writeFile(filePath, content);

  return filePath;
}
