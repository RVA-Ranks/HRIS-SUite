import type { ReactNode } from "react";
import { Nav } from "@/components/shell/Nav";

type AppShellProps = {
  children: ReactNode;
  userEmail?: string | null;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-6 md:block">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            HR Command Center
          </p>
          <p className="mt-1 text-sm text-slate-500">Phase 1 foundation</p>
        </div>
        <Nav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="md:hidden">
            <p className="text-sm font-semibold text-slate-900">HR Command Center</p>
          </div>
          <div className="ml-auto flex items-center gap-4 text-sm text-slate-600">
            {userEmail && <span>{userEmail}</span>}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
