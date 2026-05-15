import { redirect } from "next/navigation";

/** Ruta legacy → Clerk sign-in */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ? `?redirect_url=${encodeURIComponent(params.from)}` : "";
  redirect(`/sign-in${from}`);
}
