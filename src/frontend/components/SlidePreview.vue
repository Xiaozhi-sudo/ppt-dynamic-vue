<template>
  <button
    v-if="selectable"
    :aria-label="`查看第 ${slide.index + 1} 页：${slide.title || '未填充页面'}`"
    :aria-pressed="active"
    :class="['slide-thumb-button', { 'is-active': active }]"
    type="button"
    @click="emit('select')"
  >
    <SlideCanvas />
  </button>
  <SlideCanvas v-else />
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from "vue";
import type {
  AccentElement,
  BoxRegion,
  PptFillAnimation,
  RenderedSlide,
} from "@/frontend/types/ppt";

const props = withDefaults(
  defineProps<{
    slide: RenderedSlide;
    mode?: "thumbnail" | "large";
    active?: boolean;
    animation?: PptFillAnimation;
    selectable?: boolean;
    editable?: boolean;
  }>(),
  {
    mode: "large",
    active: false,
    selectable: false,
    editable: false,
  },
);

const emit = defineEmits<{
  select: [];
  "update-title": [value: string];
  "update-subtitle": [value: string];
  "update-bullet": [bulletIndex: number, value: string];
}>();

const canEditInline = computed(
  () => props.editable && props.mode === "large" && !props.selectable,
);
const liveAnimation = computed(() =>
  props.mode === "large" ? props.animation : undefined,
);
const activeField = computed(() => liveAnimation.value?.field);
const activeBulletIndex = computed(() => liveAnimation.value?.bulletIndex);
const generationCue = computed(() =>
  getGenerationCue(props.slide.index, liveAnimation.value),
);

const toRegionStyle = (region: BoxRegion) => ({
  left: `${region.x * 100}%`,
  top: `${region.y * 100}%`,
  width: `${region.w * 100}%`,
  height: `${region.h * 100}%`,
});

const toAccentStyle = (accentElement: AccentElement) => ({
  ...toRegionStyle(accentElement.region),
  backgroundColor: accentElement.color,
  opacity: accentElement.opacity ?? 1,
});

const getEditableText = (event: Event): string =>
  ((event.currentTarget as HTMLElement).textContent ?? "").trim();

const stopMultilineKey = (event: KeyboardEvent) => {
  if (event.key !== "Enter") return;

  event.preventDefault();
  (event.currentTarget as HTMLElement).blur();
};

const SlideCanvas = defineComponent({
  name: "SlideCanvas",
  setup() {
    return () => {
      const { colors, fontFamily, layout } = props.slide.style;

      return h(
        "div",
        {
          class: [
            "slide-frame",
            `slide-frame--${props.mode}`,
            `slide-frame--${props.slide.status}`,
          ],
          "data-animation-field": activeField.value,
          style: {
            background: props.slide.style.background,
            color: colors.text,
            fontFamily,
          },
        },
        [
          ...layout.accentElements.map((accentElement) =>
            h("span", {
              "aria-hidden": "true",
              class: ["slide-accent", `slide-accent--${accentElement.type}`],
              key: accentElement.id,
              style: toAccentStyle(accentElement),
            }),
          ),
          h(
            "div",
            {
              class: ["slide-title", { "is-filling": activeField.value === "title" }],
              contenteditable: canEditInline.value ? "plaintext-only" : undefined,
              "data-testid": canEditInline.value ? "inline-title-editor" : undefined,
              role: canEditInline.value ? "textbox" : undefined,
              style: toRegionStyle(layout.titleBox),
              onInput: canEditInline.value
                ? (event: Event) => emit("update-title", getEditableText(event))
                : undefined,
              onKeydown: canEditInline.value ? stopMultilineKey : undefined,
            },
            props.slide.title
              ? props.slide.title
              : h("span", { class: "slide-placeholder slide-placeholder--title" }),
          ),
          layout.subtitleBox
            ? h(
                "div",
                {
                  class: [
                    "slide-subtitle",
                    { "is-filling": activeField.value === "subtitle" },
                  ],
                  contenteditable: canEditInline.value ? "plaintext-only" : undefined,
                  "data-testid": canEditInline.value
                    ? "inline-subtitle-editor"
                    : undefined,
                  role: canEditInline.value ? "textbox" : undefined,
                  style: {
                    ...toRegionStyle(layout.subtitleBox),
                    color: colors.mutedText,
                  },
                  onInput: canEditInline.value
                    ? (event: Event) => emit("update-subtitle", getEditableText(event))
                    : undefined,
                  onKeydown: canEditInline.value ? stopMultilineKey : undefined,
                },
                props.slide.subtitle
                  ? props.slide.subtitle
                  : h("span", {
                      class: "slide-placeholder slide-placeholder--subtitle",
                    }),
              )
            : undefined,
          layout.bodyBox
            ? props.slide.bullets.length > 0
              ? h(
                  "ul",
                  {
                    class: [
                      "slide-bullets",
                      { "is-filling": activeField.value === "bullets" },
                    ],
                    style: toRegionStyle(layout.bodyBox),
                  },
                  props.slide.bullets.map((bullet, index) =>
                    h(
                      "li",
                      {
                        class: {
                          "is-active-bullet": activeBulletIndex.value === index,
                        },
                        "data-active-bullet":
                          activeBulletIndex.value === index ? "true" : undefined,
                        contenteditable: canEditInline.value ? "plaintext-only" : undefined,
                        "data-testid": canEditInline.value
                          ? `inline-bullet-editor-${index}`
                          : undefined,
                        role: canEditInline.value ? "textbox" : undefined,
                        key: `${props.slide.id}-bullet-${index}`,
                        onInput: canEditInline.value
                          ? (event: Event) =>
                              emit("update-bullet", index, getEditableText(event))
                          : undefined,
                        onKeydown: canEditInline.value ? stopMultilineKey : undefined,
                      },
                      bullet,
                    ),
                  ),
                )
              : h(
                  "div",
                  {
                    class: "slide-bullet-placeholders",
                    style: toRegionStyle(layout.bodyBox),
                  },
                  [h("span"), h("span"), h("span")],
                )
            : undefined,
          generationCue.value
            ? h(
                "div",
                { class: "slide-generation-cue", "aria-live": "polite" },
                [
                  h("span", String(props.slide.index + 1).padStart(2, "0")),
                  h("strong", generationCue.value),
                ],
              )
            : undefined,
        ],
      );
    };
  },
});

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
</script>
