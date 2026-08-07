import { describe, expect, it } from "vitest";
import { isEmailAllowlisted } from "@/server/auth/allowlist";

describe("isEmailAllowlisted", () => {
  it("matches case-insensitively", () => {
    expect(
      isEmailAllowlisted("Daniel@Example.com", ["daniel@example.com"]),
    ).toBe(true);
  });

  it("rejects emails not on the list", () => {
    expect(
      isEmailAllowlisted("other@example.com", ["daniel@example.com"]),
    ).toBe(false);
  });

  it("trims whitespace in the email", () => {
    expect(
      isEmailAllowlisted("  daniel@example.com  ", ["daniel@example.com"]),
    ).toBe(true);
  });
});
