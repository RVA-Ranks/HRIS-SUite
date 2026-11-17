import { NextResponse } from "next/server";
import { isEmailAllowlisted } from "@/server/auth/allowlist";
import { resolveBootstrapRole } from "@/server/auth/resolve-bootstrap-role";
import {
  getConfiguredAdminEmails,
  getConfiguredAllowlist,
  getConfiguredHrReviewerEmails,
  getConfiguredStaffSubmitterEmails,
} from "@/server/auth/require-user";
import { getPublicEnv, requireRuntimeAuthEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/urls";

/**
 * OAuth callback.
 *
 * Role keys are resolved only from trusted server-side email mappings
 * (AUTH_ADMIN_EMAILS / AUTH_STAFF_SUBMITTER_EMAILS / AUTH_HR_REVIEWER_EMAILS).
 * Browser input never supplies a role. Baseline roles are mutually exclusive;
 * staff_submitter and hr_reviewer never inherit read_only.
 *
 * Disabled accounts fail closed in bootstrap_oauth_user and cannot self-reactivate.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeInternalPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  try {
    requireRuntimeAuthEnv();
  } catch (error) {
    logger.error("auth.callback configuration error", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.redirect(
      new URL("/login?reason=configuration", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/login?reason=configuration", requestUrl.origin),
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    logger.error("auth.callback admin client unavailable", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.redirect(
      new URL("/login?reason=configuration", requestUrl.origin),
    );
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user?.email) {
    logger.warn("auth.callback exchange failed", { error: error?.message });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const email = data.user.email;
  const allowlist = getConfiguredAllowlist();

  if (!isEmailAllowlisted(email, allowlist)) {
    await supabase.auth.signOut();
    const { error: denyAuditError } = await admin.from("audit_events").insert({
      actor_type: "system",
      action_type: "access_denied",
      entity_type: "user",
      entity_id: email,
      after_summary: "Email not on AUTH_ALLOWLIST_EMAILS",
      source: "app",
      metadata: { reason: "allowlist" },
    });
    if (denyAuditError) {
      logger.error("auth.callback deny audit insert failed", {
        error: denyAuditError.message,
      });
    }
    return NextResponse.redirect(new URL("/denied", requestUrl.origin));
  }

  const displayName =
    (data.user.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0];

  const roleKey = resolveBootstrapRole(email, {
    adminEmails: getConfiguredAdminEmails(),
    staffSubmitterEmails: getConfiguredStaffSubmitterEmails(),
    hrReviewerEmails: getConfiguredHrReviewerEmails(),
  });

  const { data: appUserId, error: bootstrapError } = await admin.rpc(
    "bootstrap_oauth_user",
    {
      p_auth_user_id: data.user.id,
      p_email: email,
      p_display_name: displayName,
      p_role_key: roleKey,
    },
  );

  if (bootstrapError || !appUserId) {
    const message = bootstrapError?.message ?? "missing user id";
    const disabled =
      /account is (inactive|disabled|revoked|not active)/i.test(message);
    logger.error("auth.callback bootstrap failed", {
      error: message,
      disabled,
    });
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL(
        disabled ? "/denied?reason=disabled" : "/login?reason=bootstrap",
        requestUrl.origin,
      ),
    );
  }

  const { error: loginAuditError } = await admin.from("audit_events").insert({
    actor_user_id: appUserId,
    actor_type: "user",
    action_type: "login",
    entity_type: "user",
    entity_id: String(appUserId),
    after_summary: "Successful Google OAuth login",
    source: "app",
    metadata: { roleKey },
  });

  if (loginAuditError) {
    logger.error("auth.callback login audit insert failed", {
      error: loginAuditError.message,
    });
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?reason=audit", requestUrl.origin),
    );
  }

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL ?? requestUrl.origin;
  return NextResponse.redirect(new URL(nextPath, appUrl));
}
