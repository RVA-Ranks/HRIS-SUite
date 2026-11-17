import { describe, expect, it } from "vitest";
import {
  hasAnyPermission,
  hasPermission,
  PERMISSION_KEYS,
  ROLE_KEYS,
} from "@/server/auth/permissions";

describe("permissions", () => {
  const adminPermissions = Object.values(PERMISSION_KEYS);

  it("hasPermission returns true when permission exists", () => {
    expect(hasPermission(adminPermissions, PERMISSION_KEYS.AUDIT_READ)).toBe(
      true,
    );
  });

  it("hasPermission returns false when permission missing", () => {
    expect(hasPermission(["app.access"], PERMISSION_KEYS.SETTINGS_WRITE)).toBe(
      false,
    );
  });

  it("hasAnyPermission checks multiple keys", () => {
    expect(
      hasAnyPermission(["jobs.read"], [
        PERMISSION_KEYS.JOBS_READ,
        PERMISSION_KEYS.AI_USE,
      ]),
    ).toBe(true);
  });

  it("exports stable role keys", () => {
    expect(ROLE_KEYS.ADMINISTRATOR).toBe("administrator");
    expect(ROLE_KEYS.READ_ONLY).toBe("read_only");
  });
});
