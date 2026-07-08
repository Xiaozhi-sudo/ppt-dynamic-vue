import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getPptJob } from "@/lib/ppt/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pptxContentType =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

const pptxOutputDir = path.resolve(process.cwd(), ".generated", "pptx");

const isAllowedPptxPath = (filePath: string): boolean => {
  const resolvedPath = path.resolve(filePath);
  const relativePath = path.relative(pptxOutputDir, resolvedPath);

  return (
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath) &&
    path.extname(resolvedPath).toLowerCase() === ".pptx"
  );
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const job = getPptJob(jobId);

  if (!job) {
    return jsonError(`Job not found: ${jobId}`, 404);
  }

  if (job.status !== "completed" || !job.downloadPath) {
    return jsonError("PPTX is not ready for download.", 409);
  }

  if (!isAllowedPptxPath(job.downloadPath)) {
    return jsonError(`Invalid PPTX file path for job: ${jobId}`, 500);
  }

  try {
    await access(job.downloadPath, constants.F_OK);
  } catch {
    return jsonError(`PPTX file not found for job: ${jobId}`, 404);
  }

  try {
    await access(job.downloadPath, constants.R_OK);
  } catch {
    return jsonError(`PPTX file is not readable for job: ${jobId}`, 500);
  }

  let file: Buffer;
  try {
    file = await readFile(job.downloadPath);
  } catch {
    return jsonError(`Unable to read PPTX file for job: ${jobId}`, 500);
  }

  const body = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Content-Type": pptxContentType,
      "Content-Disposition": `attachment; filename="${jobId}.pptx"`,
    },
  });
}
