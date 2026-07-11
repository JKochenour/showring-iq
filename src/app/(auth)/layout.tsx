import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-paper px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl dark:bg-brand-950/40"
      />
      <Link
        href="/"
        className="font-display relative mb-8 text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50"
      >
        ShowRing <span className="text-accent-600 dark:text-accent-400">IQ</span>
      </Link>
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
