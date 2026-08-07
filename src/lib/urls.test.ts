import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/urls";

describe("safeInternalPath", () => {
  it("returns root for nullish or empty", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
  });

  it("allows relative internal paths", () => {
    expect(safeInternalPath("/")).toBe("/");
    expect(safeInternalPath("/audit")).toBe("/audit");
    expect(safeInternalPath("/settings")).toBe("/settings");
    expect(safeInternalPath("/audit?filter=login#latest")).toBe(
      "/audit?filter=login#latest",
    );
    expect(safeInternalPath("/settings?tab=flags")).toBe("/settings?tab=flags");
  });

  it("rejects open redirects and absolute URLs", () => {
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("http://evil.example/path")).toBe("/");
  });

  it("rejects backslash and encoded backslash tricks", () => {
    expect(safeInternalPath("/\\evil.com")).toBe("/");
    expect(safeInternalPath("/\\evil.example")).toBe("/");
    expect(safeInternalPath("/%5Cevil.com")).toBe("/");
    expect(safeInternalPath("/%5cevil.com")).toBe("/");
  });

  it("rejects control characters", () => {
    expect(safeInternalPath("/audit\u0000")).toBe("/");
    expect(safeInternalPath("/audit\n")).toBe("/");
  });
});
