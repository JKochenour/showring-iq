"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { login } from "@/app/(auth)/actions";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Alert, Button, Card, FieldError, Input, Label } from "@/components/ui";

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [serverError, setServerError] = useState<string | undefined>(initialError);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (values: LoginInput) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await login(values, next);
      if (result?.error) setServerError(result.error);
    });
  };

  return (
    <Card>
      <h1 className="font-display mb-6 text-2xl font-semibold text-stone-900 dark:text-stone-50">
        Sign in
      </h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && <Alert>{serverError}</Alert>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          <FieldError message={errors.password?.message} />
        </div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-stone-500 dark:text-stone-400">
        No account?{" "}
        <Link
          href="/signup"
          className="font-medium text-brand-700 hover:underline"
        >
          Create one
        </Link>
      </p>
    </Card>
  );
}
