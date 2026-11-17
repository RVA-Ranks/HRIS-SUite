import { describe, expect, it } from "vitest";
import { ROLE_KEYS } from "@/server/auth/permissions";
import { resolveBootstrapRole } from "@/server/auth/resolve-bootstrap-role";

const mapping = {
  adminEmails: ["daniel@example.test"],
  staffSubmitterEmails: ["cathi@example.test"],
  hrReviewerEmails: ["reviewer@example.test"],
};

describe("resolveBootstrapRole", () => {
  it("assigns administrator from trusted admin list only", () => {
    expect(resolveBootstrapRole("Daniel@Example.Test", mapping)).toBe(
      ROLE_KEYS.ADMINISTRATOR,
    );
  });

  it("assigns staff_submitter without falling through to read_only", () => {
    expect(resolveBootstrapRole("cathi@example.test", mapping)).toBe(
      ROLE_KEYS.STAFF_SUBMITTER,
    );
  });

  it("assigns hr_reviewer without falling through to read_only", () => {
    expect(resolveBootstrapRole("reviewer@example.test", mapping)).toBe(
      ROLE_KEYS.HR_REVIEWER,
    );
  });

  it("defaults new allowlisted accounts to read_only", () => {
    expect(resolveBootstrapRole("other@example.test", mapping)).toBe(
      ROLE_KEYS.READ_ONLY,
    );
  });

  it("prefers administrator when email is also on a restricted list", () => {
    expect(
      resolveBootstrapRole("daniel@example.test", {
        ...mapping,
        staffSubmitterEmails: ["daniel@example.test"],
      }),
    ).toBe(ROLE_KEYS.ADMINISTRATOR);
  });
});
