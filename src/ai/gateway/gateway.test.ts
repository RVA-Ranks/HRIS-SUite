import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeProvider, runAiGateway } from "@/ai/gateway";
import { resetEnvCacheForTests } from "@/lib/env";

describe("runAiGateway", () => {
  afterEach(() => {
    resetEnvCacheForTests();
    vi.restoreAllMocks();
  });

  it("returns unavailable when kill switch is on without calling provider", async () => {
    resetEnvCacheForTests();
    process.env.AI_GLOBAL_KILL_SWITCH = "true";

    const provider = new FakeProvider();
    const runSpy = vi.spyOn(provider, "run");
    const recordAiRun = vi.fn(async () => undefined);

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
        recordAiRun,
      },
    );

    expect(result.status).toBe("unavailable");
    expect(result.fallback).toBe("manual");
    expect(runSpy).not.toHaveBeenCalled();
    expect(provider.callCount).toBe(0);
    expect(recordAiRun).toHaveBeenCalledWith(
      expect.objectContaining({
        useCase: "smoke.test",
        status: "unavailable",
        storeFlag: true,
      }),
    );
  });

  it("always attempts metadata audit even when store is false", async () => {
    process.env.AI_GLOBAL_KILL_SWITCH = "false";
    process.env.OPENAI_API_KEY = "fabricated-test-key";
    resetEnvCacheForTests();

    const provider = new FakeProvider();
    const recorded: Array<Record<string, unknown>> = [];

    const result = await runAiGateway(
      {
        useCase: "smoke.sensitive",
        classification: "sensitive",
        schema: "test.v1",
        input: { ssn: "123-45-6789" },
        promptVersion: "v1",
        schemaVersion: "v1",
        store: false,
      },
      {
        provider,
        featureFlagReader: async () => true,
        recordAiRun: async (row) => {
          recorded.push(row as unknown as Record<string, unknown>);
        },
      },
    );

    expect(result.status).toBe("success");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      useCase: "smoke.sensitive",
      status: "success",
      storeFlag: false,
      disposition: "completed",
    });
    expect(recorded[0]).not.toHaveProperty("input");
    expect(JSON.stringify(recorded[0])).not.toContain("123-45-6789");
  });

  it("records failed metadata when the provider throws", async () => {
    process.env.AI_GLOBAL_KILL_SWITCH = "false";
    process.env.OPENAI_API_KEY = "fabricated-test-key";
    resetEnvCacheForTests();

    const provider = new FakeProvider();
    vi.spyOn(provider, "run").mockRejectedValue(new Error("boom"));
    const recordAiRun = vi.fn(async () => undefined);

    const result = await runAiGateway(
      {
        useCase: "smoke.fail",
        classification: "internal",
        schema: "test.v1",
        input: { message: "hello" },
        promptVersion: "v1",
        schemaVersion: "v1",
      },
      {
        provider,
        featureFlagReader: async () => true,
        recordAiRun,
      },
    );

    expect(result.status).toBe("error");
    expect(recordAiRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorCode: "provider_error",
      }),
    );
  });
});
