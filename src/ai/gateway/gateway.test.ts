import { describe, expect, it, vi } from "vitest";
import { FakeProvider, runAiGateway } from "@/ai/gateway";
import { resetEnvCacheForTests } from "@/lib/env";

describe("runAiGateway", () => {
  it("returns unavailable when kill switch is on without calling provider", async () => {
    resetEnvCacheForTests();
    process.env.AI_GLOBAL_KILL_SWITCH = "true";

    const provider = new FakeProvider();
    const runSpy = vi.spyOn(provider, "run");

    const result = await runAiGateway(
      {
        useCase: "smoke.test",
        classification: "internal",
        schema: "test.v1",
        input: { message: "hello" },
        promptVersion: "v1",
        schemaVersion: "v1",
      },
      {
        provider,
        featureFlagReader: async () => true,
      },
    );

    expect(result.status).toBe("unavailable");
    expect(result.fallback).toBe("manual");
    expect(runSpy).not.toHaveBeenCalled();
    expect(provider.callCount).toBe(0);
  });
});
