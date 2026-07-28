"use client";

import { getApiBaseUrl } from "@/lib/api/config";
import { SiteFooter } from "@/components/site-footer";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Mismo foco que el resto de la app: el anillo usa el token --ring (no el
// primario a pelo) y se separa 1px del borde, igual que <Input>.
const inputClass =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-primary-border hover:border-border-strong";

// Botones de la pantalla de acceso: no usan <Button> (esta ruta va sin el
// bundle de la app), así que replican su gesto de pulsación.
const submitClass =
  "transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary/90 active:scale-[0.98] focus-ring disabled:opacity-60 disabled:active:scale-100";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [info, setInfo] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setError(null);
    try {
      // Carga el cliente Supabase solo al usarlo, fuera del bundle inicial del login.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${origin}/auth/callback`,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setInfo("Si la cuenta existe, te enviaremos un email con instrucciones.");
      setShowForgotPassword(false);
    } catch {
      setError("No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setForgotLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const emailNormalized = email.trim().toLowerCase();

    try {
      const limitRes = await fetch(`${getApiBaseUrl()}/auth/password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", email: emailNormalized }),
      });
      if (!limitRes.ok) {
        setError("Demasiados intentos. Espera unos minutos antes de reintentar.");
        return;
      }

      const loginRes = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNormalized, password }),
      });
      if (!loginRes.ok) {
        setError("Email o contraseña incorrectos.");
        return;
      }

      // Refresca el cliente de Supabase con las cookies que fijó el servidor.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.getSession();
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background via-background to-primary/4" />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
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

        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="px-6 pb-6 pt-6">
            <h1 className="text-base font-semibold text-foreground">Iniciar sesión</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Acceso restringido a cuentas autorizadas por el Comité de Jueces.
            </p>

            <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
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
                  autoComplete="current-password"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground ${submitClass}`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Entrar
              </button>
            </form>

            <div className="mt-3">
              {!showForgotPassword ? (
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="rounded text-xs text-muted-foreground/70 underline-offset-2 transition-colors hover:text-muted-foreground hover:underline focus-ring"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              ) : (
                <form
                  onSubmit={(e) => void handleForgotPassword(e)}
                  className="mt-1 flex gap-2"
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
                    className={`shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground ${submitClass}`}
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

            {error && (
              <div
                role="alert"
                // rise-in: el aviso no debe materializarse de golpe bajo el
                // formulario; entra desde 4px con la curva del sistema.
                className="rise-in mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive-muted px-3.5 py-2.5"
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
                className="rise-in mt-4 flex items-start gap-2.5 rounded-xl border border-success/20 bg-success-muted px-3.5 py-2.5"
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

        <SiteFooter className="mt-6" />
      </div>
    </div>
  );
}
