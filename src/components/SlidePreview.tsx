import React from "react";
import type {
  AccentElement,
  BoxRegion,
  PptFillAnimation,
  RenderedSlide,
} from "@/lib/ppt/types";

export interface SlidePreviewProps {
  slide: RenderedSlide;
  mode?: "thumbnail" | "large";
  active?: boolean;
  animation?: PptFillAnimation;
  onSelect?: () => void;
}

const toRegionStyle = (region: BoxRegion): React.CSSProperties => ({
  left: `${region.x * 100}%`,
  top: `${region.y * 100}%`,
  width: `${region.w * 100}%`,
  height: `${region.h * 100}%`,
});

const toAccentStyle = (accentElement: AccentElement): React.CSSProperties => ({
  ...toRegionStyle(accentElement.region),
  backgroundColor: accentElement.color,
  opacity: accentElement.opacity ?? 1,
});

export function SlidePreview({
  slide,
  mode = "large",
  active = false,
  animation,
  onSelect,
}: SlidePreviewProps) {
  const { colors, fontFamily, layout } = slide.style;
  const liveAnimation = mode === "large" ? animation : undefined;
  const activeField = liveAnimation?.field;
  const activeBulletIndex = liveAnimation?.bulletIndex;
  const generationCue = getGenerationCue(slide.index, liveAnimation);
  const content = (
    <div
      className={`slide-frame slide-frame--${mode} slide-frame--${slide.status}`}
      data-animation-field={activeField}
      style={{
        background: slide.style.background,
        color: colors.text,
        fontFamily,
      }}
    >
      {layout.accentElements.map((accentElement) => (
        <span
          aria-hidden="true"
          className={`slide-accent slide-accent--${accentElement.type}`}
          key={accentElement.id}
          style={toAccentStyle(accentElement)}
        />
      ))}

      <div
        className={`slide-title${activeField === "title" ? " is-filling" : ""}`}
        style={toRegionStyle(layout.titleBox)}
      >
        {slide.title || <span className="slide-placeholder slide-placeholder--title" />}
      </div>

      {layout.subtitleBox ? (
        <div
          className={`slide-subtitle${
            activeField === "subtitle" ? " is-filling" : ""
          }`}
          style={{
            ...toRegionStyle(layout.subtitleBox),
            color: colors.mutedText,
          }}
        >
          {slide.subtitle || <span className="slide-placeholder slide-placeholder--subtitle" />}
        </div>
      ) : null}

      {layout.bodyBox ? (
        slide.bullets.length > 0 ? (
          <ul
            className={`slide-bullets${
              activeField === "bullets" ? " is-filling" : ""
            }`}
            style={toRegionStyle(layout.bodyBox)}
          >
            {slide.bullets.map((bullet, index) => (
              <li
                className={activeBulletIndex === index ? "is-active-bullet" : undefined}
                data-active-bullet={activeBulletIndex === index || undefined}
                key={`${slide.id}-bullet-${index}`}
              >
                {bullet}
              </li>
            ))}
          </ul>
        ) : (
          <div className="slide-bullet-placeholders" style={toRegionStyle(layout.bodyBox)}>
            <span />
            <span />
            <span />
          </div>
        )
      ) : null}

      {generationCue ? (
        <div className="slide-generation-cue" aria-live="polite">
          <span>{String(slide.index + 1).padStart(2, "0")}</span>
          <strong>{generationCue}</strong>
        </div>
      ) : null}
    </div>
  );

  if (!onSelect) {
    return content;
  }

  return (
    <button
      aria-label={`查看第 ${slide.index + 1} 页：${slide.title}`}
      aria-pressed={active}
      className={`slide-thumb-button${active ? " is-active" : ""}`}
      onClick={onSelect}
      type="button"
    >
      {content}
    </button>
  );
}

const getGenerationCue = (
  slideIndex: number,
  animation?: PptFillAnimation,
): string | undefined => {
  if (!animation) return undefined;

  const page = slideIndex + 1;

  if (animation.phase === "template") {
    return "正在铺设 PPT 模板骨架";
  }

  if (animation.field === "title") {
    return `正在填充第 ${page} 页标题`;
  }

  if (animation.field === "subtitle") {
    return `正在填充第 ${page} 页副标题`;
  }

  if (animation.field === "bullets") {
    return `正在填充第 ${page} 页要点 ${(animation.bulletIndex ?? 0) + 1}`;
  }

  if (animation.phase === "ready") {
    return `第 ${page} 页已生成`;
  }

  return undefined;
};
