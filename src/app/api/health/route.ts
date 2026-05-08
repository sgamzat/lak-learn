import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "lak-learn-app" }, { status: 200 });
}

