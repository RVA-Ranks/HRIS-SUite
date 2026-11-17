type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({
  title = "Something went wrong",
  message,
}: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8">
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      <p className="mt-2 text-sm text-red-800">{message}</p>
    </div>
  );
}
