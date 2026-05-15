import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="app-mesh flex min-h-screen items-center justify-center p-6">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "glass-panel border-border shadow-none",
          },
        }}
      />
    </div>
  );
}
