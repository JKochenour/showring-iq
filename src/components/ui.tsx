import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonStyles = {
  primary:
    "bg-brand-700 text-white shadow-sm hover:bg-brand-800 hover:shadow disabled:bg-brand-700/50",
  secondary:
    "border border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800",
  danger:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-stone-900 dark:text-red-400 dark:hover:bg-red-950",
} as const;

/** touch-manipulation removes the 300ms double-tap-zoom delay — matters
 * for gate/scoring tablets where staff tap the same button repeatedly. */
const buttonBase =
  "inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-950";

/** lg = finger-sized (≥44px tall) for arena tablet screens. */
const buttonSizes = {
  md: "px-4 py-2 text-sm",
  lg: "min-h-11 px-6 py-2.5 text-base",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof buttonStyles;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button
      className={cx(buttonBase, buttonSizes[size], buttonStyles[variant], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: keyof typeof buttonStyles;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <Link
      className={cx(buttonBase, buttonSizes[size], buttonStyles[variant], className)}
      {...props}
    />
  );
}

const fieldStyles =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldStyles, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldStyles, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldStyles, className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cx(
        "mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300",
        className
      )}
      {...props}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    success:
      "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300",
    info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  };
  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "accent" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
    brand: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
    accent: "bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-300",
    success: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-stone-200 bg-white p-6 shadow-sm transition-shadow dark:border-stone-800 dark:bg-stone-900",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-10 text-center dark:border-stone-700 dark:bg-stone-900/50">
      <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
