import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv, resetEnvCacheForTests } from "@/lib/env";

describe("AUTH_ADMIN_EMAILS parsing", () => {
  afterEach(() => {
    delete process.env.AUTH_ALLOWLIST_EMAILS;
    delete process.env.AUTH_ADMIN_EMAILS;
    resetEnvCacheForTests();
  });

  it("parses admin emails separately from the allowlist", () => {
    process.env.AUTH_ALLOWLIST_EMAILS =
      "daniel@example.com, peer@example.com";
    process.env.AUTH_ADMIN_EMAILS = " Daniel@Example.com , other-admin@example.com ";
    resetEnvCacheForTests();

    const env = getServerEnv();
    expect(env.authAllowlistEmails).toEqual([
      "daniel@example.com",
      "peer@example.com",
    ]);
    expect(env.authAdminEmails).toEqual([
      "daniel@example.com",
      "other-admin@example.com",
    ]);
  });

  it("defaults admin emails to empty when unset", () => {
    process.env.AUTH_ALLOWLIST_EMAILS = "daniel@example.com";
    delete process.env.AUTH_ADMIN_EMAILS;
    resetEnvCacheForTests();

    expect(getServerEnv().authAdminEmails).toEqual([]);
  });
});
