import { describe, expect, it } from "vitest";
import { redactInput, redactSensitiveText } from "@/ai/gateway/redaction";

describe("redactSensitiveText", () => {
  it("redacts API key shaped strings", () => {
    expect(redactSensitiveText("token sk-abcdefghijklmnop")).toContain(
      "[REDACTED]",
    );
  });
});

describe("redactInput", () => {
  it("recurses into nested objects", () => {
    const result = redactInput({
      outer: {
        password: "password=hunter2",
      },
    });
    expect(result.outer).toEqual({ password: "[REDACTED]" });
  });

  it("recurses into nested arrays of secrets", () => {
    const result = redactInput({
      batches: [
        {
          notes: ["safe", "api_key=sk-abcdefghijklmnop"],
          nested: [{ token: "token=abc123" }, "SSN 123-45-6789"],
        },
        ["password: secretvalue", { deep: ["AKIAIOSFODNN7EXAMPLE"] }],
      ],
    });

    const batches = result.batches as unknown[];
    const first = batches[0] as {
      notes: string[];
      nested: Array<Record<string, string> | string>;
    };
    expect(first.notes[0]).toBe("safe");
    expect(first.notes[1]).toBe("[REDACTED]");
    expect(first.nested[0]).toEqual({ token: "[REDACTED]" });
    expect(first.nested[1]).toBe("SSN [REDACTED]");

    const second = batches[1] as unknown[];
    expect(second[0]).toBe("[REDACTED]");
    expect(second[1]).toEqual({ deep: ["[REDACTED]"] });
  });
});
