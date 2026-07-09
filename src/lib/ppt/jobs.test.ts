import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPptJobsForTests,
  createPptJob,
  getPptJob,
  getPptJobListenerCountForTests,
  subscribeToPptJob,
  updatePptJobSlides,
} from "./jobs";
import type { PptJob } from "./types";

const waitForJob = async (
  jobId: string,
  predicate: (job: PptJob | undefined) => boolean,
  timeoutMs = 2500,
): Promise<PptJob | undefined> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = getPptJob(jobId);
    if (predicate(job)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const job = getPptJob(jobId);
  throw new Error(`Timed out waiting for job ${jobId}; last status ${job?.status}`);
};

describe("ppt jobs", () => {
  beforeEach(() => {
    clearPptJobsForTests();
  });

  afterEach(() => {
    clearPptJobsForTests();
  });

  it("createPptJob creates a queued job", () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "business-blue",
      useLlm: false,
    });

    expect(job.id).toMatch(/^job_[A-Za-z0-9_-]+$/);
    expect(job.status).toBe("queued");
    expect(job.currentStep).toBe("analyzing");
    expect(job.progress).toBe(0);
    expect(job.slides).toEqual([]);
  });

  it("completes a valid job with slides and a pptx download path", async () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "business-blue",
      useLlm: false,
    });

    const completed = await waitForJob(
      job.id,
      (candidate) => candidate?.status === "completed",
    );

    if (!completed) throw new Error("job did not complete");
    expect(completed.currentStep).toBe("completed");
    expect(completed.progress).toBe(100);
    expect(completed.slides).toHaveLength(6);
    expect(completed.downloadPath).toContain(".pptx");
  });

  it("subscribeToPptJob receives progress and completed events", async () => {
    const job = createPptJob({
      topic: "智慧零售增长",
      templateId: "fresh-green",
      useLlm: false,
    });
    const eventTypes: string[] = [];
    const steps: string[] = [];

    const unsubscribe = subscribeToPptJob(job.id, (event) => {
      eventTypes.push(event.type);
      steps.push(event.step);
    });

    await waitForJob(job.id, (candidate) => candidate?.status === "completed");
    unsubscribe();

    expect(eventTypes).toContain("progress");
    expect(eventTypes).toContain("completed");
    expect(steps).toContain("filling_slides");
    expect(steps).toContain("rendering_preview");
    expect(steps.at(-1)).toBe("completed");
  });

  it("emits template-only and incremental slide fill events before completion", async () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "business-blue",
      useLlm: false,
    });
    const slideEvents: Array<{
      phase?: string;
      titles: string[];
      bulletCounts: number[];
    }> = [];

    subscribeToPptJob(job.id, (event) => {
      if (event.type !== "slides" || !event.slides) return;
      slideEvents.push({
        phase: event.animation?.phase,
        titles: event.slides.map((slide) => slide.title),
        bulletCounts: event.slides.map((slide) => slide.bullets.length),
      });
    });

    await waitForJob(job.id, (candidate) => candidate?.status === "completed");

    expect(slideEvents[0].phase).toBe("template");
    expect(slideEvents[0].titles.every((title) => title === "")).toBe(true);
    expect(slideEvents[0].bulletCounts.every((count) => count === 0)).toBe(true);
    expect(slideEvents.some((event) => event.titles[0].includes("智能制造趋势"))).toBe(true);
    expect(slideEvents.some((event) => event.bulletCounts[1] === 1)).toBe(true);
  });

  it("fails with a clear error for an unknown template", async () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "unknown-template",
      useLlm: false,
    });

    const failed = await waitForJob(
      job.id,
      (candidate) => candidate?.status === "failed",
    );

    if (!failed) throw new Error("job did not fail");
    expect(failed.error).toContain("未找到模板");
    expect(failed.error).toContain("unknown-template");
  });

  it("keeps a job running when a subscriber throws", async () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "business-blue",
      useLlm: false,
    });
    const receivedSteps: string[] = [];

    subscribeToPptJob(job.id, () => {
      throw new Error("subscriber failed");
    });
    subscribeToPptJob(job.id, (event) => {
      receivedSteps.push(event.step);
    });

    const completed = await waitForJob(
      job.id,
      (candidate) => candidate?.status === "completed",
    );

    if (!completed) throw new Error("job did not complete");
    expect(completed.status).toBe("completed");
    expect(receivedSteps).toContain("completed");
    expect(getPptJobListenerCountForTests(job.id)).toBe(0);
  });

  it("getPptJob returns a snapshot that cannot mutate internal state", async () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "business-blue",
      useLlm: false,
    });

    const completed = await waitForJob(
      job.id,
      (candidate) => candidate?.status === "completed",
    );
    if (!completed) throw new Error("job did not complete");
    completed.status = "failed";
    completed.progress = 1;
    completed.slides.length = 0;

    const stored = getPptJob(job.id);
    expect(stored?.status).toBe("completed");
    expect(stored?.progress).toBe(100);
    expect(stored?.slides).toHaveLength(6);
  });

  it("updates completed job text fields and refreshes the pptx download path", async () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "business-blue",
      useLlm: false,
    });
    const completed = await waitForJob(
      job.id,
      (candidate) => candidate?.status === "completed",
    );
    if (!completed) throw new Error("job did not complete");

    const editedSlides = completed.slides.map((slide, index) =>
      index === 0
        ? {
            ...slide,
            title: "编辑后的封面标题",
            subtitle: "编辑后的副标题",
            bullets: ["编辑后的要点"],
            notes: "编辑后的备注",
          }
        : slide,
    );

    const updated = await updatePptJobSlides(job.id, editedSlides);

    expect(updated.slides[0].title).toBe("编辑后的封面标题");
    expect(updated.slides[0].subtitle).toBe("编辑后的副标题");
    expect(updated.slides[0].bullets).toEqual(["编辑后的要点"]);
    expect(updated.slides[0].notes).toBe("编辑后的备注");
    expect(updated.downloadPath).toContain(`${job.id}.pptx`);
    expect(getPptJob(job.id)?.slides[0].title).toBe("编辑后的封面标题");
  });

  it("cleans terminal jobs and listeners after retention", async () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "business-blue",
      retentionMs: 150,
      useLlm: false,
    });
    const eventTypes: string[] = [];

    subscribeToPptJob(job.id, (event) => {
      eventTypes.push(event.type);
    });

    await waitForJob(job.id, (candidate) => candidate?.status === "completed");
    expect(eventTypes).toContain("completed");
    expect(getPptJobListenerCountForTests(job.id)).toBe(0);

    await waitForJob(job.id, (candidate) => candidate === undefined, 1000);
    expect(getPptJob(job.id)).toBeUndefined();
  });
});
