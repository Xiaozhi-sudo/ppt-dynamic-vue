import { NextResponse } from "next/server";
import { templates } from "@/lib/ppt/templates";

export async function GET() {
  return NextResponse.json({ templates });
}
