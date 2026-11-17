import { redirect } from "next/navigation";
import { AuthError } from "@/server/auth/require-user";

export function redirectForAuthError(error: unknown): never {
  if (error instanceof AuthError) {
    if (error.code === "unauthenticated" || error.code === "configuration") {
      redirect("/login");
    }
    redirect("/denied");
  }
  throw error;
}
