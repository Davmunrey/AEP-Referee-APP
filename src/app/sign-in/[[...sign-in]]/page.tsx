"use client";

import { getApiBaseUrl } from "@/lib/api/config";
import { SiteFooter } from "@/components/site-footer";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { mensajeDeAcceso, SIN_ACCESO_PARAM, SIN_ACCESO_VALUE } from "@/lib/auth/sign-in-redirect";

// Mismo foco que el resto de la app: el anillo usa el token --ring (no el
// primario a pelo) y se separa 1px del borde, igual que <Input>.
const inputClass =
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-subtle-muted transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-primary-border hover:border-border-strong";

// Etiqueta visible encima de cada campo: con solo el placeholder, el nombre
// del campo desaparecía al empezar a escribir.
const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

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
  // Solo un código conocido, nunca el texto que venga en la URL: ver
  // `MENSAJES_ACCESO`.
  const [error, setError] = useState<string | null>(mensajeDeAcceso(searchParams.get("error")));
  const [info, setInfo] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  // Llega aquí quien tiene sesión de auth válida pero ningún perfil activo en
  // la aplicación: una cuenta creada por su cuenta (que nace inactiva) o una
  // desactivada después. Antes esto era un bucle de redirecciones sin texto.
  // No se cierra aquí esa sesión de auth: sería un logout por navegación GET,
  // que es justo lo que se quitó de /auth/signout. Tampoco hace falta —con la
  // excepción del middleware cada intento acaba en esta pantalla, no en un
  // bucle— y la cookie caduca sola.
  const sinAcceso = searchParams.get(SIN_ACCESO_PARAM) === SIN_ACCESO_VALUE;
  const [forgotEmail, setForgotEmail] = useState("");
  // Los jueces entran con un enlace al e-mail del censo, sin contraseña.
  // `?juez=1` abre directamente esa pestaña (es el enlace que se les comparte).
  const [modo, setModo] = useState<"gestion" | "juez">(searchParams.get("juez") === "1" ? "juez" : "gestion");
  const [judgeEmail, setJudgeEmail] = useState("");
  const [judgeLoading, setJudgeLoading] = useState(false);

  const requestJudgeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setJudgeLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/judge-access`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: judgeEmail.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { data?: { message?: string }; error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "No se pudo enviar el enlace. Inténtalo de nuevo.");
        return;
      }
      setInfo(body?.data?.message ?? "Si ese e-mail figura en el censo, te llegará un enlace para entrar.");
    } catch {
      setError("No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setJudgeLoading(false);
    }
  };
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
    // Fondo liso del lienzo: la marca la ponen el logotipo y el botón rojo;
    // el halo y el degradado de antes solo restaban calma a una pantalla que
    // se ve a diario.
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/assets/aep-master-logo.png"
            alt="Asociación Española de Powerlifting"
            width={280}
            height={76}
            className="h-auto w-60 dark:hidden"
            priority
          />
          <Image
            src="/assets/aep-master-logo-light.png"
            alt="Asociación Española de Powerlifting"
            width={280}
            height={76}
            className="h-auto w-60 hidden dark:block"
          />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Plataforma de gestión de jueces
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="px-6 pb-6 pt-6">
            <div role="tablist" aria-label="Tipo de acceso" className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
              {(
                [
                  ["gestion", "Gestión AEP"],
                  ["juez", "Soy juez"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={modo === value}
                  onClick={() => {
                    setModo(value);
                    setError(null);
                    setInfo(null);
                  }}
                  className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-ring ${
                    modo === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {modo === "juez" ? (
              <>
                <h1 className="text-base font-semibold text-foreground">Acceso de jueces</h1>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Escribe el e-mail que figura en tu ficha del censo y te enviaremos un enlace para entrar. No
                  necesitas contraseña: sirve igual la primera vez que las siguientes.
                </p>
                <form onSubmit={(e) => void requestJudgeLink(e)} className="mt-5 space-y-3">
                  <div>
                    <label htmlFor="judge-email" className={labelClass}>
                      Tu e-mail
                    </label>
                    <input
                      id="judge-email"
                      type="email"
                      placeholder="nombre@ejemplo.com"
                      value={judgeEmail}
                      onChange={(e) => setJudgeEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={judgeLoading}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground ${submitClass}`}
                  >
                    {judgeLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Enviarme el enlace
                  </button>
                </form>
              </>
            ) : (
            <>
            <h1 className="text-base font-semibold text-foreground">Iniciar sesión</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Acceso restringido a cuentas autorizadas por el Comité de Jueces.
            </p>

            {sinAcceso && (
              <div
                role="status"
                className="rise-in mt-4 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning-muted px-3.5 py-2.5"
              >
                <AlertCircle className="mt-px h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <p className="text-xs leading-snug text-warning">
                  Tu cuenta existe pero todavía no tiene acceso al panel. Pide al Comité de Jueces
                  que la active.
                </p>
              </div>
            )}

            <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className={labelClass}>
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
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
                  className="inline-flex min-h-9 items-center rounded text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-ring"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              ) : (
                <form onSubmit={(e) => void handleForgotPassword(e)} className="mt-1">
                  <label htmlFor="forgot-email" className={labelClass}>
                    E-mail de tu cuenta
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="forgot-email"
                      type="email"
                      placeholder="nombre@ejemplo.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className={inputClass}
                    />
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className={`shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground ${submitClass}`}
                    >
                      {forgotLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        "Enviar enlace"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
            </>
            )}

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
