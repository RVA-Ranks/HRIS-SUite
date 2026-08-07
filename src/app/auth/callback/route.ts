import { NextResponse } from "next/server";
import { isEmailAllowlisted } from "@/server/auth/allowlist";
import { ROLE_KEYS } from "@/server/auth/permissions";
import {
  getConfiguredAdminEmails,
  getConfiguredAllowlist,
} from "@/server/auth/require-user";
import { getPublicEnv, requireRuntimeAuthEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/urls";

/**
 * OAuth callback.
 *
 * Daniel (and other admins) must be on BOTH AUTH_ALLOWLIST_EMAILS (login) and
 * AUTH_ADMIN_EMAILS (administrator role bootstrap). Allowlisted non-admins
 * receive the read_only role.
 *
 * User upsert + role assignment run in a single SECURITY DEFINER RPC
 * (bootstrap_oauth_user) via the service-role client. Login audit inserts
 * fail closed: session is cleared and the user is sent back to login.
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
  const adminEmails = getConfiguredAdminEmails();

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

  const roleKey = isEmailAllowlisted(email, adminEmails)
    ? ROLE_KEYS.ADMINISTRATOR
    : ROLE_KEYS.READ_ONLY;

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
    logger.error("auth.callback bootstrap failed", {
      error: bootstrapError?.message ?? "missing user id",
    });
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?reason=bootstrap", requestUrl.origin),
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
