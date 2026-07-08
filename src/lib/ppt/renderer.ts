import type { BoxRegion, GeneratedDeck, PptTemplate, RenderedSlide, SlideLayout } from "./types";

const copyBoxRegion = (region: BoxRegion): BoxRegion => ({ ...region });

const copyLayout = (layout: SlideLayout): SlideLayout => ({
  ...layout,
  titleBox: copyBoxRegion(layout.titleBox),
  subtitleBox: layout.subtitleBox ? copyBoxRegion(layout.subtitleBox) : undefined,
  bodyBox: layout.bodyBox ? copyBoxRegion(layout.bodyBox) : undefined,
  accentElements: layout.accentElements.map((accentElement) => ({
    ...accentElement,
    region: copyBoxRegion(accentElement.region),
  })),
});

export function renderDeck(deck: GeneratedDeck, template: PptTemplate): RenderedSlide[] {
  return deck.slides.map((slide, index) => {
    const layout = template.layouts[slide.layoutType];
    if (!layout) {
      throw new Error(`模板 ${template.id} 缺少 ${slide.layoutType} 布局`);
    }
    const renderedLayout = copyLayout(layout);

    return {
      id: `${template.id}-${slide.id}`,
      index,
      layoutType: slide.layoutType,
      templateId: template.id,
      title: slide.title,
      subtitle: slide.subtitle,
      bullets: [...slide.bullets],
      notes: slide.notes,
      style: {
        colors: { ...template.colors },
        fontFamily: template.fontFamily,
        layout: renderedLayout,
        background: renderedLayout.background,
      },
      status: "ready",
    };
  });
}
