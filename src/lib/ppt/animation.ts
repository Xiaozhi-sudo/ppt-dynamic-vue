import type { PptFillAnimation, RenderedSlide } from "./types";

export interface SlideFillFrame {
  slides: RenderedSlide[];
  animation: PptFillAnimation;
}

const cloneSlide = (slide: RenderedSlide): RenderedSlide => ({
  ...slide,
  bullets: [...slide.bullets],
  style: {
    ...slide.style,
    colors: { ...slide.style.colors },
    layout: {
      ...slide.style.layout,
      titleBox: { ...slide.style.layout.titleBox },
      subtitleBox: slide.style.layout.subtitleBox
        ? { ...slide.style.layout.subtitleBox }
        : undefined,
      bodyBox: slide.style.layout.bodyBox ? { ...slide.style.layout.bodyBox } : undefined,
      accentElements: slide.style.layout.accentElements.map((accentElement) => ({
        ...accentElement,
        region: { ...accentElement.region },
      })),
    },
  },
});

const createEmptySlide = (slide: RenderedSlide): RenderedSlide => ({
  ...cloneSlide(slide),
  title: "",
  subtitle: "",
  bullets: [],
  status: "pending",
});

const createFrame = (
  slides: RenderedSlide[],
  animation: PptFillAnimation,
): SlideFillFrame => ({
  slides: slides.map(cloneSlide),
  animation,
});

export const createSlideFillFrames = (finalSlides: RenderedSlide[]): SlideFillFrame[] => {
  const workingSlides = finalSlides.map(createEmptySlide);
  const frames: SlideFillFrame[] = [
    createFrame(workingSlides, {
      phase: "template",
      field: "template",
      slideIndex: 0,
    }),
  ];

  finalSlides.forEach((finalSlide, slideIndex) => {
    workingSlides[slideIndex] = {
      ...workingSlides[slideIndex],
      title: finalSlide.title,
      status: "filling",
    };
    frames.push(createFrame(workingSlides, {
      phase: "title",
      field: "title",
      slideIndex,
    }));

    if (finalSlide.subtitle) {
      workingSlides[slideIndex] = {
        ...workingSlides[slideIndex],
        subtitle: finalSlide.subtitle,
      };
      frames.push(createFrame(workingSlides, {
        phase: "subtitle",
        field: "subtitle",
        slideIndex,
      }));
    }

    finalSlide.bullets.forEach((bullet, bulletIndex) => {
      workingSlides[slideIndex] = {
        ...workingSlides[slideIndex],
        bullets: [...workingSlides[slideIndex].bullets, bullet],
      };
      frames.push(createFrame(workingSlides, {
        phase: "bullets",
        field: "bullets",
        slideIndex,
        bulletIndex,
      }));
    });

    workingSlides[slideIndex] = {
      ...cloneSlide(finalSlide),
      status: "ready",
    };
    frames.push(createFrame(workingSlides, {
      phase: "ready",
      field: "slide",
      slideIndex,
    }));
  });

  frames.push(createFrame(finalSlides, {
    phase: "ready",
    field: "slide",
    slideIndex: finalSlides.length - 1,
  }));

  return frames;
};
