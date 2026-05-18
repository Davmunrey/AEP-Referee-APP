import { redirect } from "next/navigation";

interface EventRedirectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventRedirectPage({ params }: EventRedirectPageProps) {
  const { id } = await params;
  redirect(`/competitions/${id}`);
}
