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
    expect(safeInternalPath("/settings?tab=flags")).toBe("/settings?tab=flags");
  });

  it("rejects open redirects and absolute URLs", () => {
    expect(safeInternalPath("//evil.example")).toBe("/");
    expect(safeInternalPath("https://evil.example")).toBe("/");
    expect(safeInternalPath("http://evil.example/path")).toBe("/");
    expect(safeInternalPath("/ok://still-bad")).toBe("/");
  });
});
