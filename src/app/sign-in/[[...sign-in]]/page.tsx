"use client";

import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: nombre || email.split("@")[0] },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setInfo("Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión.");
        setMode("signin");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(
        err.message.includes("Invalid login")
          ? "Email o contraseña incorrectos."
          : err.message.includes("Email not confirmed")
            ? "Confirma tu email antes de iniciar sesión."
            : err.message,
      );
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/assets/aep-master-logo.png"
            alt="Asociación Española de Powerlifting"
            width={280}
            height={76}
            className="h-auto w-64"
            priority
          />
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Plataforma de gestión arbitral
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
          <h1 className="text-base font-semibold text-foreground">
            {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "signin"
              ? "Accede con tu cuenta federativa."
              : "Regístrate para solicitar acceso a la plataforma."}
          </p>

          <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Nombre completo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-subtle-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-subtle-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-subtle-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              )}
              {mode === "signin" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg bg-destructive-muted px-3 py-2 text-center text-xs text-destructive">
              {error}
            </p>
          )}
          {info && (
            <p className="mt-4 rounded-lg bg-success-muted px-3 py-2 text-center text-xs text-success">
              {info}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
              setInfo(null);
            }}
            className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {mode === "signin"
              ? "¿No tienes cuenta? Crear una"
              : "¿Ya tienes cuenta? Iniciar sesión"}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-subtle-muted">
          Acceso para personal federativo AEP. El primer usuario registrado obtiene
          rol Nacional; el resto requiere aprobación del equipo nacional.
        </p>
      </div>
    </div>
  );
}
