import { redirect } from "next/navigation";

export default async function NewEventPage() {
  redirect("/competitions/new");
}
