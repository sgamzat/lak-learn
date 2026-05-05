import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ready",
      service: "frontend",
      timestamp_utc: new Date().toISOString(),
    },
    { status: 200 },
  );
}

