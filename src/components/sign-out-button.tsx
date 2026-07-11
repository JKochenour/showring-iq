"use client";

import { useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => signOut())}
      disabled={isPending}
      className="text-sm text-stone-500 hover:text-stone-900 disabled:opacity-50 dark:text-stone-400 dark:hover:text-stone-100"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
