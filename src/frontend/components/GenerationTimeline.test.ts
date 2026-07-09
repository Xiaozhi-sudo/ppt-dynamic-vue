import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import GenerationTimeline from "./GenerationTimeline.vue";

describe("GenerationTimeline", () => {
  it("marks previous steps done and the current step active", () => {
    const wrapper = mount(GenerationTimeline, {
      props: {
        currentStep: "filling_slides",
        progress: 55,
        status: "running",
      },
    });

    expect(wrapper.get("[role='progressbar']").attributes("aria-valuenow")).toBe("55");
    expect(wrapper.findAll(".timeline-step.is-done")).toHaveLength(3);
    expect(wrapper.findAll(".timeline-step.is-active")).toHaveLength(1);
    expect(wrapper.text()).toContain("填充页面");
  });

  it("clamps progress and shows failed state on the current step", () => {
    const wrapper = mount(GenerationTimeline, {
      props: {
        currentStep: "exporting",
        progress: 150,
        status: "failed",
      },
    });

    expect(wrapper.get("[role='progressbar']").attributes("aria-valuenow")).toBe("100");
    expect(wrapper.find(".timeline-step.is-failed").exists()).toBe(true);
  });
});
