import { NextResponse } from "next/server";
import { isEmailAllowlisted } from "@/server/auth/allowlist";
import { ROLE_KEYS } from "@/server/auth/permissions";
import { getConfiguredAllowlist } from "@/server/auth/require-user";
import { recordAuditEvent } from "@/server/audit/record";
import { getPublicEnv, requireRuntimeAuthEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next") ?? "/";

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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user?.email) {
    logger.warn("auth.callback exchange failed", { error: error?.message });
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const email = data.user.email;
  const allowlist = getConfiguredAllowlist();

  if (!isEmailAllowlisted(email, allowlist)) {
    await supabase.auth.signOut();
    await recordAuditEvent({
      actionType: "access_denied",
      entityType: "user",
      entityId: email,
      afterSummary: "Email not on AUTH_ALLOWLIST_EMAILS",
      metadata: { reason: "allowlist" },
    });
    return NextResponse.redirect(new URL("/denied", requestUrl.origin));
  }

  const displayName =
    (data.user.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0];

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  let appUserId = existingUser?.id;

  if (!appUserId) {
    const { data: insertedUser, error: insertError } = await supabase
      .from("users")
      .insert({
        auth_user_id: data.user.id,
        email,
        display_name: displayName,
        status: "active",
        last_login_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !insertedUser) {
      logger.error("auth.callback user upsert failed", {
        error: insertError?.message,
      });
      return NextResponse.redirect(new URL("/login", requestUrl.origin));
    }

    appUserId = insertedUser.id;
  } else {
    await supabase
      .from("users")
      .update({
        last_login_at: new Date().toISOString(),
        display_name: displayName,
      })
      .eq("id", appUserId);
  }

  const { data: adminRole } = await supabase
    .from("roles")
    .select("id")
    .eq("key", ROLE_KEYS.ADMINISTRATOR)
    .maybeSingle();

  if (adminRole) {
    await supabase.from("user_roles").upsert(
      {
        user_id: appUserId,
        role_id: adminRole.id,
      },
      { onConflict: "user_id,role_id" },
    );
  }

  await recordAuditEvent({
    actorUserId: appUserId,
    actionType: "login",
    entityType: "user",
    entityId: appUserId,
    afterSummary: "Successful Google OAuth login",
  });

  const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL ?? requestUrl.origin;
  return NextResponse.redirect(new URL(nextPath, appUrl));
}
