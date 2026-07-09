import { NextResponse } from "next/server";
import { updatePptJobSlides } from "@/lib/ppt/jobs";
import type { RenderedSlide } from "@/lib/ppt/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isEditableSlidePayload = (value: unknown): value is RenderedSlide => {
  if (!value || typeof value !== "object") return false;
  const slide = value as Partial<RenderedSlide>;

  return (
    typeof slide.id === "string" &&
    typeof slide.title === "string" &&
    (slide.subtitle === undefined || typeof slide.subtitle === "string") &&
    isStringArray(slide.bullets) &&
    (slide.notes === undefined || typeof slide.notes === "string")
  );
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError("Request body must be an object.", 400);
  }

  const { slides } = body as { slides?: unknown };
  if (!Array.isArray(slides) || !slides.every(isEditableSlidePayload)) {
    return jsonError("slides must be an array of editable slide payloads.", 400);
  }

  try {
    const job = await updatePptJobSlides(jobId, slides);
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存修改失败。";
    const status = message.startsWith("Job not found") ? 404 : 400;
    return jsonError(message, status);
  }
}
