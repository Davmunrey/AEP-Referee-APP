"use client";

import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

const inputClass =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary hover:border-border-strong";

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
  // L4 — forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setShowForgotPassword(false);
    setForgotEmail("");
  };

  // L4 — send password-reset email
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setError(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${origin}/auth/callback`,
    });
    setForgotLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo("Si la cuenta existe, te enviaremos un email con instrucciones.");
    setShowForgotPassword(false);
  };

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background via-background to-primary/4" />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + tagline */}
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/assets/aep-master-logo.png"
            alt="Asociación Española de Powerlifting"
            width={280}
            height={76}
            className="h-auto w-60"
            priority
          />
          <p className="mt-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
            Plataforma de gestión de jueces
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-card">
          {/* Accent top border */}
          <div className="h-0.5 w-full rounded-t-2xl bg-primary" />

          {/* Tab switcher */}
          <div className="px-6 pt-5">
            <div className="flex rounded-xl border border-border bg-surface p-1">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  mode === "signin"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  mode === "signup"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Crear cuenta
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="px-6 pb-6 pt-5">
            <p className="mb-4 text-xs text-muted-foreground">
              {mode === "signin"
                ? "Accede con tu cuenta federativa."
                : "Regístrate para solicitar acceso a la plataforma."}
            </p>

            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              {/* M12 — nombre required in signup mode */}
              {mode === "signup" && (
                <div>
                  <label htmlFor="nombre" className="sr-only">
                    Nombre completo
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    placeholder="Nombre completo *"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="name"
                    required
                    className={inputClass}
                  />
                </div>
              )}
              <div>
                <label htmlFor="email" className="sr-only">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                {mode === "signin" ? "Entrar" : "Crear cuenta"}
              </button>

              {/* M11 — solo_ver role notice in signup mode */}
              {mode === "signup" && (
                <p className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs text-muted-foreground">
                  Tu cuenta tendrá acceso de solo lectura hasta que un administrador te asigne un
                  rol.
                </p>
              )}
            </form>

            {/* L4 — Forgot password (signin mode only, outside main form to avoid nesting) */}
            {mode === "signin" && (
              <div className="mt-2">
                {!showForgotPassword ? (
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="rounded text-xs text-muted-foreground/70 underline-offset-2 transition-colors hover:text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                ) : (
                  <form
                    onSubmit={(e) => void handleForgotPassword(e)}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      type="email"
                      placeholder="Tu email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className={inputClass}
                    />
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                    >
                      {forgotLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        "Enviar enlace"
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Messages */}
            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive-muted px-3.5 py-2.5"
              >
                <AlertCircle
                  className="mt-px h-4 w-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <p className="text-xs leading-snug text-destructive">{error}</p>
              </div>
            )}
            {info && (
              <div
                role="status"
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-success/20 bg-success-muted px-3.5 py-2.5"
              >
                <CheckCircle2
                  className="mt-px h-4 w-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <p className="text-xs leading-snug text-success">{info}</p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground/60">
          AEP · Gestión de jueces interna
        </p>
      </div>
    </div>
  );
}
