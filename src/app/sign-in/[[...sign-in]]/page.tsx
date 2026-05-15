import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="app-mesh flex min-h-screen items-center justify-center p-6">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
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
