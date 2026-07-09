import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in — ShowRing IQ" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return <LoginForm next={next} initialError={error} />;
}
