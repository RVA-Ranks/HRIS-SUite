import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/test/db/**", "node_modules/**"],
    env: {
      AUTH_ALLOWLIST_EMAILS: "daniel@example.com,ops@example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      AI_GLOBAL_KILL_SWITCH: "true",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/shims/server-only.ts"),
    },
  },
});
