"use client";

import { useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => signOut())}
      disabled={isPending}
      className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
