import { NextResponse } from "next/server";
import { createPptJob } from "@/lib/ppt/jobs";
import { getTemplateById } from "@/lib/ppt/templates";

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError("Request body must be an object.", 400);
  }

  const { topic, templateId } = body as {
    topic?: unknown;
    templateId?: unknown;
  };

  if (typeof topic !== "string" || topic.trim().length === 0) {
    return jsonError("topic must be a non-empty string.", 400);
  }

  if (typeof templateId !== "string" || templateId.length === 0) {
    return jsonError("templateId must be a non-empty string.", 400);
  }

  if (!getTemplateById(templateId)) {
    return jsonError(`Template not found: ${templateId}`, 400);
  }

  const job = createPptJob({
    topic: topic.trim(),
    templateId,
  });

  return NextResponse.json({ jobId: job.id });
}
