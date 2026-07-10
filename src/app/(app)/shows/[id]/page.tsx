import { redirect } from "next/navigation";

export default async function ShowIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/shows/${id}/dashboard`);
}
