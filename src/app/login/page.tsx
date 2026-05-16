import { redirect } from "next/navigation";

/** Ruta legacy → /sign-in */
export default function LoginPage() {
  redirect("/sign-in");
}
