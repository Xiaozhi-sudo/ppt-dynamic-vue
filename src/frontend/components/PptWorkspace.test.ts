import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PptWorkspace from "./PptWorkspace.vue";
import type { PptJobEvent, PptTemplate, RenderedSlide } from "@/frontend/types/ppt";

const template: PptTemplate = {
  id: "business-blue",
  name: "商务蓝",
  description: "正式汇报模板",
  theme: "Business",
  colors: {
    primary: "#1D4ED8",
    secondary: "#38BDF8",
    accent: "#F59E0B",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    text: "#0F172A",
    mutedText: "#475569",
  },
  fontFamily: "Microsoft YaHei",
  layouts: {} as PptTemplate["layouts"],
};

const slide: RenderedSlide = {
  id: "slide-1",
  index: 0,
  layoutType: "cover",
  templateId: "business-blue",
  title: "原始标题",
  subtitle: "原始副标题",
  bullets: ["原始要点"],
  notes: "原始备注",
  status: "ready",
  style: {
    background: "#FFFFFF",
    fontFamily: "Microsoft YaHei",
    colors: template.colors,
    layout: {
      type: "cover",
      background: "#FFFFFF",
      titleBox: { x: 0.1, y: 0.1, w: 0.7, h: 0.2 },
      subtitleBox: { x: 0.1, y: 0.32, w: 0.7, h: 0.12 },
      bodyBox: { x: 0.1, y: 0.5, w: 0.7, h: 0.2 },
      accentElements: [],
    },
  },
};

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  emit(event: PptJobEvent) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent<string>);
  }

  close() {}
}

describe("PptWorkspace editing", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("edits completed slide text and saves the changed slides to the job", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url === "/api/templates") {
        return Response.json({ templates: [template] });
      }
      if (url === "/api/ppt/jobs") {
        return Response.json({ jobId: "job_edit" });
      }
      if (url === "/api/ppt/jobs/job_edit" && init?.method === "PATCH") {
        return Response.json({
          job: {
            slides: JSON.parse(init.body as string).slides,
          },
        });
      }
      return Response.json({ error: "not found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(PptWorkspace);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.get("#ppt-topic").setValue("测试主题");
    await wrapper.get(".primary-action").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    MockEventSource.instances[0].emit({
      type: "completed",
      jobId: "job_edit",
      step: "completed",
      message: "PPT 已生成完成",
      progress: 100,
      status: "completed",
      slides: [slide],
    });
    await wrapper.vm.$nextTick();

    const title = wrapper.get("[data-testid='inline-title-editor']");
    title.element.textContent = "编辑后的标题";
    await title.trigger("input");
    const subtitle = wrapper.get("[data-testid='inline-subtitle-editor']");
    subtitle.element.textContent = "编辑后的副标题";
    await subtitle.trigger("input");
    const bullet = wrapper.get("[data-testid='inline-bullet-editor-0']");
    bullet.element.textContent = "编辑后的要点";
    await bullet.trigger("input");
    await wrapper.get("#slide-notes-editor").setValue("编辑后的备注");
    await wrapper.get("[data-testid='save-slide-edits']").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/ppt/jobs/job_edit" && init?.method === "PATCH",
    );
    expect(patchCall).toBeTruthy();
    const body = JSON.parse(patchCall?.[1]?.body as string);
    expect(body.slides[0].title).toBe("编辑后的标题");
    expect(body.slides[0].subtitle).toBe("编辑后的副标题");
    expect(body.slides[0].bullets).toEqual(["编辑后的要点"]);
    expect(body.slides[0].notes).toBe("编辑后的备注");
    expect(wrapper.text()).toContain("修改已保存");
  });
});
