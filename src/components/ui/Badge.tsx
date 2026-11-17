import clsx from "clsx";
import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-teal-50 text-teal-800 border-teal-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  danger: "bg-red-50 text-red-800 border-red-200",
  muted: "bg-slate-100 text-slate-700 border-slate-200",
};

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
