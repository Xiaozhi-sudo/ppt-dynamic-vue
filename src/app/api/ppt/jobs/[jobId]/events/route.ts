import { NextResponse } from "next/server";
import { getPptJob, subscribeToPptJob } from "@/lib/ppt/jobs";
import { pptStepMessages } from "@/lib/ppt/steps";
import type { PptJob, PptJobEvent, PptJobEventType } from "@/lib/ppt/types";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const getSnapshotEventType = (job: PptJob): PptJobEventType => {
  if (job.status === "completed") return "completed";
  if (job.status === "failed") return "error";
  return "status";
};

const toSnapshotEvent = (job: PptJob): PptJobEvent => ({
  type: getSnapshotEventType(job),
  jobId: job.id,
  step: job.currentStep,
  message: job.error ?? pptStepMessages[job.currentStep],
  progress: job.progress,
  status: job.status,
  slides: job.slides,
  error: job.error,
});

const isTerminalEvent = (event: PptJobEvent): boolean =>
  event.status === "completed" || event.status === "failed";

const writeEvent = (
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: PptJobEvent,
) => {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
};

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const job = getPptJob(jobId);

  if (!job) {
    return jsonError(`Job not found: ${jobId}`, 404);
  }

  let unsubscribe: (() => void) | undefined;
  let removeAbortListener: (() => void) | undefined;
  let closed = false;

  const cleanup = () => {
    unsubscribe?.();
    unsubscribe = undefined;
    removeAbortListener?.();
    removeAbortListener = undefined;
  };

  const closeStream = (
    controller: ReadableStreamDefaultController<Uint8Array>,
  ) => {
    if (closed) return;
    closed = true;
    cleanup();

    try {
      controller.close();
    } catch {
      // The client may have already closed the stream.
    }
  };

  const safeWriteEvent = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: PptJobEvent,
  ): boolean => {
    if (closed) return false;

    try {
      writeEvent(controller, event);
      return true;
    } catch {
      closeStream(controller);
      return false;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const abort = () => closeStream(controller);
      request.signal.addEventListener("abort", abort, { once: true });
      removeAbortListener = () => {
        request.signal.removeEventListener("abort", abort);
      };

      if (!safeWriteEvent(controller, toSnapshotEvent(job))) {
        return;
      }
      if (job.status === "completed" || job.status === "failed") {
        closeStream(controller);
        return;
      }

      unsubscribe = subscribeToPptJob(job.id, (event) => {
        if (closed) return;
        if (!safeWriteEvent(controller, event)) {
          return;
        }

        if (isTerminalEvent(event)) {
          closeStream(controller);
        }
      });

      const latestJob = getPptJob(job.id);
      if (latestJob && latestJob.updatedAt !== job.updatedAt) {
        const latestEvent = toSnapshotEvent(latestJob);
        if (!safeWriteEvent(controller, latestEvent)) {
          return;
        }

        if (isTerminalEvent(latestEvent)) {
          closeStream(controller);
        }
      }
    },
    cancel() {
      closed = true;
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
