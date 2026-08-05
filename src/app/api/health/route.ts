import { NextResponse } from "next/server";
import { createCorrelationId } from "@/lib/correlation";
import { getEnvStatus } from "@/lib/env";

export async function GET() {
  const correlationId = createCorrelationId();

  return NextResponse.json(
    {
      ok: true,
      env: getEnvStatus(),
      timestamp: new Date().toISOString(),
      correlationId,
    },
    {
      headers: {
        "x-correlation-id": correlationId,
      },
    },
  );
}
