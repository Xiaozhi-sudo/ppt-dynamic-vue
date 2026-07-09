import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import TemplatePicker from "./TemplatePicker.vue";
import type { PptTemplate } from "@/frontend/types/ppt";

const templates: PptTemplate[] = [
  {
    id: "business-blue",
    name: "商务蓝",
    description: "适合经营分析和正式汇报",
    theme: "Business",
    colors: {
      primary: "#123456",
      secondary: "#456789",
      accent: "#f59e0b",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#111827",
      mutedText: "#64748b",
    },
    fontFamily: "Microsoft YaHei",
    layouts: {} as PptTemplate["layouts"],
  },
];

describe("TemplatePicker", () => {
  it("renders templates and emits the selected template id", async () => {
    const wrapper = mount(TemplatePicker, {
      props: {
        selectedTemplateId: "business-blue",
        templates,
      },
    });

    expect(wrapper.text()).toContain("商务蓝");
    expect(wrapper.text()).toContain("适合经营分析和正式汇报");
    expect(wrapper.get("button").attributes("aria-pressed")).toBe("true");

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("select")).toEqual([["business-blue"]]);
  });

  it("shows a loading state while templates are empty", () => {
    const wrapper = mount(TemplatePicker, {
      props: {
        templates: [],
      },
    });

    expect(wrapper.text()).toContain("模板加载中");
  });
});
