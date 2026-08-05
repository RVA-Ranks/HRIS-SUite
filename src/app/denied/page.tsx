import Link from "next/link";

export default function DeniedPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your Google account is not on the Phase 1 allowlist. Contact the
          platform owner if you believe this is an error.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
