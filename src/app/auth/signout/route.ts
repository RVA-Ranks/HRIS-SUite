import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/require-user";
import { recordAuditEvent } from "@/server/audit/record";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  const supabase = await createClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  if (user) {
    await recordAuditEvent({
      actorUserId: user.id,
      actionType: "logout",
      entityType: "user",
      entityId: user.id,
      afterSummary: "User signed out",
    });
  }

  const requestUrl = new URL(request.url);
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
