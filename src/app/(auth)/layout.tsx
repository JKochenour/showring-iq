import Link from "next/link";

// Auth shell carries the marketing language: dark oiled-leather canvas, a
// quiet turquoise wash, Space Grotesk wordmark. The form itself stays on a
// warm light card for input legibility.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#17120F] px-4 py-12 text-stone-200">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(67,167,156,0.16),transparent_65%)]"
      />
      <Link
        href="/"
        className="font-grotesk relative mb-8 text-2xl font-semibold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
      >
        ShowRing <span className="text-brand-400">IQ</span>
      </Link>
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
