"use client";

type FilterBarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
};

export function FilterBar({
  searchValue = "",
  onSearchChange,
  placeholder = "Search…",
  children,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      {onSearchChange && (
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      )}
      {children}
    </div>
  );
}
