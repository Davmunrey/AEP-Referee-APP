import { redirect } from "next/navigation";

// Sign-up via Google — handled in /sign-in
export default function SignUpPage() {
  redirect("/sign-in");
}
