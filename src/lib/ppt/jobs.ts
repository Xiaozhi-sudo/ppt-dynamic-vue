import { exportPptx } from "./exporter";
import { generateDeckContent } from "./generator";
import { generateDeckContentWithLlm } from "./llm";
import { createSlideFillFrames } from "./animation";
import { renderDeck } from "./renderer";
import { pptStepMessages } from "./steps";
import { getTemplateById } from "./templates";
import type {
  PptJob,
  PptJobEvent,
  PptJobEventType,
  PptFillAnimation,
  PptStepKey,
  RenderedSlide,
} from "./types";

interface CreatePptJobOptions {
  topic: string;
  templateId: string;
  retentionMs?: number;
  useLlm?: boolean;
}

type PptJobListener = (event: PptJobEvent) => void;

interface PptJobStore {
  jobs: Map<string, PptJob>;
  listeners: Map<string, Set<PptJobListener>>;
  cleanupTimers: Map<string, ReturnType<typeof setTimeout>>;
  delayTimers: Set<ReturnType<typeof setTimeout>>;
  retentionMsByJob: Map<string, number>;
  useLlmByJob: Map<string, boolean>;
}

const globalStoreKey = Symbol.for("ppt-gen-test-v1:ppt-job-store");

const getStore = (): PptJobStore => {
  const globalWithStore = globalThis as typeof globalThis & {
    [globalStoreKey]?: PptJobStore;
  };

  globalWithStore[globalStoreKey] ??= {
    jobs: new Map<string, PptJob>(),
    listeners: new Map<string, Set<PptJobListener>>(),
    cleanupTimers: new Map<string, ReturnType<typeof setTimeout>>(),
    delayTimers: new Set<ReturnType<typeof setTimeout>>(),
    retentionMsByJob: new Map<string, number>(),
    useLlmByJob: new Map<string, boolean>(),
  };

  return globalWithStore[globalStoreKey];
};

const {
  jobs,
  listeners,
  cleanupTimers,
  delayTimers,
  retentionMsByJob,
  useLlmByJob,
} = getStore();
const stepDelayMs = 35;
const defaultRetentionMs = 5 * 60 * 1000;

const createJobId = (): string =>
  `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      delayTimers.delete(timer);
      resolve();
    }, ms);
    delayTimers.add(timer);
  });

const getListeners = (jobId: string): Set<PptJobListener> | undefined =>
  listeners.get(jobId);

const cloneRenderedSlide = (slide: RenderedSlide): RenderedSlide => ({
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

const cloneJob = (job: PptJob): PptJob => ({
  ...job,
  slides: job.slides.map(cloneRenderedSlide),
});

const cloneJobEvent = (event: PptJobEvent): PptJobEvent => ({
  ...event,
  animation: event.animation ? { ...event.animation } : undefined,
  slides: event.slides?.map(cloneRenderedSlide),
});

const isTerminalStatus = (job: PptJob): boolean =>
  job.status === "completed" || job.status === "failed";

export const deletePptJob = (id: string): void => {
  jobs.delete(id);
  listeners.delete(id);
  retentionMsByJob.delete(id);
  useLlmByJob.delete(id);

  const cleanupTimer = cleanupTimers.get(id);
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimers.delete(id);
  }
};

const scheduleTerminalCleanup = (job: PptJob): void => {
  const existingTimer = cleanupTimers.get(job.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const retentionMs = retentionMsByJob.get(job.id) ?? defaultRetentionMs;
  const timer = setTimeout(() => {
    cleanupTimers.delete(job.id);
    deletePptJob(job.id);
  }, retentionMs);
  cleanupTimers.set(job.id, timer);
};

const emitJobEvent = (
  job: PptJob,
  type: PptJobEventType,
  message?: string,
  animation?: PptFillAnimation,
) => {
  const jobListeners = getListeners(job.id);
  if (!jobListeners || jobListeners.size === 0) {
    return;
  }

  const event: PptJobEvent = {
    type,
    jobId: job.id,
    step: job.currentStep,
    message: message ?? pptStepMessages[job.currentStep],
    progress: job.progress,
    status: job.status,
    slides: job.slides.map(cloneRenderedSlide),
    animation,
    error: job.error,
  };

  for (const listener of jobListeners) {
    try {
      listener(cloneJobEvent(event));
    } catch {
      jobListeners.delete(listener);
    }
  }
};

const updateJob = (
  job: PptJob,
  updates: Partial<
    Pick<
      PptJob,
      "status" | "currentStep" | "progress" | "slides" | "downloadPath" | "error"
    >
  >,
  eventType: PptJobEventType,
  message?: string,
  animation?: PptFillAnimation,
): PptJob => {
  const updatedJob: PptJob = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  jobs.set(updatedJob.id, updatedJob);
  emitJobEvent(updatedJob, eventType, message, animation);
  if (isTerminalStatus(updatedJob)) {
    listeners.delete(updatedJob.id);
    scheduleTerminalCleanup(updatedJob);
  }
  return updatedJob;
};

const updateProgress = async (
  job: PptJob,
  currentStep: PptStepKey,
  progress: number,
  slides?: RenderedSlide[],
): Promise<PptJob> => {
  await delay(stepDelayMs);
  const latestJob = jobs.get(job.id);
  if (!latestJob) {
    return job;
  }

  return updateJob(
    latestJob,
    {
      status: "running",
      currentStep,
      progress,
      ...(slides ? { slides } : {}),
    },
    slides ? "slides" : "progress",
  );
};

const updateSlideFrame = async (
  job: PptJob,
  slides: RenderedSlide[],
  animation: PptFillAnimation,
  progress: number,
): Promise<PptJob> => {
  await delay(stepDelayMs);
  const latestJob = jobs.get(job.id);
  if (!latestJob) {
    return job;
  }

  return updateJob(
    latestJob,
    {
      status: "running",
      currentStep: "filling_slides",
      progress,
      slides,
    },
    "slides",
    getFillMessage(animation),
    animation,
  );
};

const getFillMessage = (animation: PptFillAnimation): string => {
  const page = animation.slideIndex + 1;
  if (animation.phase === "template") return "正在铺设 PPT 模板骨架";
  if (animation.phase === "title") return `正在填充第 ${page} 页标题`;
  if (animation.phase === "subtitle") return `正在填充第 ${page} 页副标题`;
  if (animation.phase === "bullets") return `正在填充第 ${page} 页要点`;
  return `第 ${page} 页内容已填充完成`;
};

const failJob = (job: PptJob, error: unknown): PptJob => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return updateJob(
    job,
    {
      status: "failed",
      error: errorMessage,
    },
    "error",
    errorMessage,
  );
};

const runPptJob = async (jobId: string): Promise<void> => {
  let job = jobs.get(jobId);
  if (!job) {
    return;
  }

  try {
    job = await updateProgress(job, "analyzing", 10);
    if (!jobs.has(jobId)) return;

    const template = getTemplateById(job.templateId);
    if (!template) {
      throw new Error(`未找到模板: ${job.templateId}`);
    }

    const useLlm = useLlmByJob.get(job.id) ?? true;
    let deck = generateDeckContent(job.topic, {
      createdAt: new Date().toISOString(),
    });
    if (useLlm) {
      try {
        deck = await generateDeckContentWithLlm(job.topic);
      } catch (error) {
        console.warn("LLM generation failed; falling back to local generator.", error);
      }
    }
    job = await updateProgress(job, "outline", 25);
    if (!jobs.has(jobId)) return;
    job = await updateProgress(job, "matching_template", 40);
    if (!jobs.has(jobId)) return;

    const renderedSlides = renderDeck(deck, template);
    const fillFrames = createSlideFillFrames(renderedSlides);
    for (const [frameIndex, frame] of fillFrames.entries()) {
      const progress = 45 + Math.round((frameIndex / Math.max(1, fillFrames.length - 1)) * 33);
      job = await updateSlideFrame(job, frame.slides, frame.animation, progress);
      if (!jobs.has(jobId)) return;
    }
    job = await updateProgress(job, "rendering_preview", 80, renderedSlides);
    if (!jobs.has(jobId)) return;
    job = await updateProgress(job, "exporting", 90, renderedSlides);
    if (!jobs.has(jobId)) return;

    const downloadPath = await exportPptx({
      slides: renderedSlides,
      template,
      jobId: job.id,
    });

    updateJob(
      job,
      {
        status: "completed",
        currentStep: "completed",
        progress: 100,
        slides: renderedSlides,
        downloadPath,
      },
      "completed",
    );
  } catch (error) {
    const currentJob = jobs.get(jobId);
    if (currentJob) {
      failJob(currentJob, error);
    }
  }
};

export const createPptJob = ({
  topic,
  templateId,
  retentionMs,
  useLlm = true,
}: CreatePptJobOptions): PptJob => {
  const now = new Date().toISOString();
  const job: PptJob = {
    id: createJobId(),
    topic,
    templateId,
    status: "queued",
    currentStep: "analyzing",
    progress: 0,
    slides: [],
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(job.id, job);
  retentionMsByJob.set(job.id, Math.max(0, retentionMs ?? defaultRetentionMs));
  useLlmByJob.set(job.id, useLlm);
  const startTimer = setTimeout(() => {
    delayTimers.delete(startTimer);
    void runPptJob(job.id);
  }, 0);
  delayTimers.add(startTimer);

  return cloneJob(job);
};

export const getPptJob = (id: string): PptJob | undefined => {
  const job = jobs.get(id);
  return job ? cloneJob(job) : undefined;
};

export const subscribeToPptJob = (
  id: string,
  listener: PptJobListener,
): (() => void) => {
  const jobListeners = listeners.get(id) ?? new Set<PptJobListener>();
  jobListeners.add(listener);
  listeners.set(id, jobListeners);

  return () => {
    const currentListeners = listeners.get(id);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      listeners.delete(id);
    }
  };
};

export const clearPptJobsForTests = (): void => {
  jobs.clear();
  listeners.clear();
  retentionMsByJob.clear();
  useLlmByJob.clear();

  for (const timer of cleanupTimers.values()) {
    clearTimeout(timer);
  }
  cleanupTimers.clear();

  for (const timer of delayTimers.values()) {
    clearTimeout(timer);
  }
  delayTimers.clear();
};

export const getPptJobListenerCountForTests = (id: string): number =>
  listeners.get(id)?.size ?? 0;

export type { PptJobListener };
