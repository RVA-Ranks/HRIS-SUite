import { describe, expect, it } from "vitest";
import {
  hasAnyPermission,
  hasPermission,
  PERMISSION_KEYS,
  PHASE2_PERMISSION_KEYS,
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
    expect(ROLE_KEYS.STAFF_SUBMITTER).toBe("staff_submitter");
    expect(ROLE_KEYS.HR_REVIEWER).toBe("hr_reviewer");
  });

  it("lists Phase 2 permission keys without granting them to read_only by type alone", () => {
    expect(PHASE2_PERMISSION_KEYS).toContain(PERMISSION_KEYS.TASKS_CREATE_OWN);
    expect(PHASE2_PERMISSION_KEYS).toContain(PERMISSION_KEYS.COMPENSATION_READ);
    expect(
      hasPermission(["app.access", "audit.read"], PERMISSION_KEYS.TASKS_CREATE_OWN),
    ).toBe(false);
  });
});
