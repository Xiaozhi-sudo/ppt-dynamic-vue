import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SlidePreview from "./SlidePreview.vue";
import type { PptFillAnimation, RenderedSlide } from "@/frontend/types/ppt";

const createSlide = (): RenderedSlide => ({
  id: "slide-2",
  index: 1,
  layoutType: "content",
  templateId: "business-blue",
  title: "市场机会",
  subtitle: "增长判断",
  bullets: ["第一条要点"],
  status: "filling",
  style: {
    background: "#ffffff",
    fontFamily: "Microsoft YaHei",
    colors: {
      primary: "#123456",
      secondary: "#456789",
      accent: "#f59e0b",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#111827",
      mutedText: "#64748b",
    },
    layout: {
      type: "content",
      background: "#ffffff",
      titleBox: { x: 0.08, y: 0.1, w: 0.5, h: 0.16 },
      subtitleBox: { x: 0.08, y: 0.27, w: 0.5, h: 0.1 },
      bodyBox: { x: 0.08, y: 0.42, w: 0.72, h: 0.34 },
      accentElements: [
        {
          id: "accent-1",
          type: "rect",
          region: { x: 0, y: 0, w: 0.02, h: 1 },
          color: "#123456",
        },
      ],
    },
  },
});

describe("SlidePreview", () => {
  it("renders the active generation cue on the large preview canvas", () => {
    const animation: PptFillAnimation = {
      phase: "bullets",
      field: "bullets",
      slideIndex: 1,
      bulletIndex: 0,
    };
    const wrapper = mount(SlidePreview, {
      props: {
        animation,
        mode: "large",
        slide: createSlide(),
      },
    });

    expect(wrapper.text()).toContain("正在填充第 2 页要点 1");
    expect(wrapper.get(".slide-frame").attributes("data-animation-field")).toBe("bullets");
    expect(wrapper.get("[data-active-bullet='true']").text()).toBe("第一条要点");
  });

  it("keeps thumbnails as progress indicators instead of playing field animations", () => {
    const animation: PptFillAnimation = {
      phase: "bullets",
      field: "bullets",
      slideIndex: 1,
      bulletIndex: 0,
    };
    const wrapper = mount(SlidePreview, {
      props: {
        animation,
        mode: "thumbnail",
        slide: createSlide(),
      },
    });

    expect(wrapper.find(".slide-generation-cue").exists()).toBe(false);
    expect(wrapper.find("[data-active-bullet='true']").exists()).toBe(false);
    expect(wrapper.find(".is-filling").exists()).toBe(false);
  });

  it("emits inline text edits from the large preview canvas", async () => {
    const wrapper = mount(SlidePreview, {
      props: {
        editable: true,
        mode: "large",
        slide: createSlide(),
      },
    });

    const title = wrapper.get("[data-testid='inline-title-editor']");
    title.element.textContent = "页面直接编辑标题";
    await title.trigger("input");

    const subtitle = wrapper.get("[data-testid='inline-subtitle-editor']");
    subtitle.element.textContent = "页面直接编辑副标题";
    await subtitle.trigger("input");

    const bullet = wrapper.get("[data-testid='inline-bullet-editor-0']");
    bullet.element.textContent = "页面直接编辑要点";
    await bullet.trigger("input");

    expect(wrapper.emitted("update-title")).toEqual([["页面直接编辑标题"]]);
    expect(wrapper.emitted("update-subtitle")).toEqual([["页面直接编辑副标题"]]);
    expect(wrapper.emitted("update-bullet")).toEqual([[0, "页面直接编辑要点"]]);
  });
});
