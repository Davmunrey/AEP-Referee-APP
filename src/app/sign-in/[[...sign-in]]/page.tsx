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
  "w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-subtle-muted transition-[color,background-color,border-color,box-shadow] duration-(--duration-base) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-primary-border hover:border-border-strong";

// Etiqueta visible encima de cada campo: con solo el placeholder, el nombre
// del campo desaparecía al empezar a escribir.
const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

// Botones de la pantalla de acceso: no usan <Button> (esta ruta va sin el
// bundle de la app), así que replican su gesto de pulsación.
const linkClass =
  "inline-flex min-h-9 items-center rounded text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-ring";

const submitClass =
  "transition-[background-color,box-shadow,transform] duration-(--duration-base) hover:bg-primary/90 active:scale-(--scale-press) focus-ring disabled:opacity-60 disabled:active:scale-100";

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
  // La aplicación no envía correos. Los jueces entran con e-mail y contraseña
  // como la gestión; la primera vez (o tras olvidarla) crean la contraseña con
  // el código que les da su delegado. `?juez=1` abre la pestaña de jueces y
  // `?codigo=1` directamente el formulario del código (es el enlace del
  // mensaje que copia el delegado).
  const conCodigo = searchParams.get("codigo") === "1";
  const [modo, setModo] = useState<"gestion" | "juez">(
    conCodigo || searchParams.get("juez") === "1" ? "juez" : "gestion",
  );
  const [vistaJuez, setVistaJuez] = useState<"entrar" | "codigo" | "pedir">(conCodigo ? "codigo" : "entrar");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const resetAvisos = () => {
    setError(null);
    setInfo(null);
  };

  /** Entra con e-mail y contraseña (gestión y jueces, la misma cuenta de auth). */
  const login = async (emailValue: string, passwordValue: string): Promise<boolean> => {
    const emailNormalized = emailValue.trim().toLowerCase();
    const limitRes = await fetch(`${getApiBaseUrl()}/auth/password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", email: emailNormalized }),
    });
    if (!limitRes.ok) {
      setError("Demasiados intentos. Espera unos minutos antes de reintentar.");
      return false;
    }
    const loginRes = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailNormalized, password: passwordValue }),
    });
    if (!loginRes.ok) {
      setError("Email o contraseña incorrectos.");
      return false;
    }
    // Refresca el cliente de Supabase con las cookies que fijó el servidor.
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.getSession();
    router.push("/");
    router.refresh();
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetAvisos();
    try {
      await login(email, password);
    } catch {
      setError("No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  /** El juez canjea su código, crea la contraseña y entra con ella. */
  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAvisos();
    if (newPassword !== newPassword2) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/judge-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code, password: newPassword }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "No se pudo completar el acceso. Inténtalo de nuevo.");
        return;
      }
      await login(email, newPassword);
    } catch {
      setError("No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  /** Sin código: avisa al delegado de su zona (dentro de la app). */
  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetAvisos();
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/judge-access`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { data?: { message?: string }; error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "No se pudo enviar la petición. Inténtalo de nuevo.");
        return;
      }
      setInfo(body?.data?.message ?? "Petición enviada a tu delegado de zona.");
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
                    setShowForgotPassword(false);
                    resetAvisos();
                  }}
                  className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-ring ${
                    modo === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Formulario de entrada: el mismo para gestión y jueces. */}
            {(modo === "gestion" || vistaJuez === "entrar") && (
              <>
                <h1 className="text-base font-semibold text-foreground">
                  {modo === "juez" ? "Acceso de jueces" : "Iniciar sesión"}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {modo === "juez"
                    ? "Entra con el e-mail de tu ficha del censo y tu contraseña."
                    : "Acceso restringido a cuentas autorizadas por el Comité de Jueces."}
                </p>

                {sinAcceso && modo === "gestion" && (
                  <div
                    role="status"
                    className="rise-in mt-4 flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning-muted px-3.5 py-2.5"
                  >
                    <AlertCircle className="mt-px h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    <p className="text-xs leading-snug text-warning">
                      Tu cuenta existe pero todavía no tiene acceso al panel. Pide al Comité de Jueces que la active.
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
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Entrar
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-x-4">
                  {modo === "juez" && (
                    <button type="button" onClick={() => { setVistaJuez("codigo"); resetAvisos(); }} className={linkClass}>
                      Tengo un código
                    </button>
                  )}
                  <button type="button" onClick={() => setShowForgotPassword((v) => !v)} className={linkClass} aria-expanded={showForgotPassword}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                {/* La aplicación no envía correos, así que no hay enlace para
                    restablecerla: la pone de nuevo quien da los accesos. */}
                {showForgotPassword && (
                  <p className="rise-in mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
                    {modo === "juez" ? (
                      <>
                        Pide a tu delegado de zona un código nuevo y úsalo en «Tengo un código» para crear otra.{" "}
                        <button type="button" onClick={() => { setVistaJuez("pedir"); resetAvisos(); }} className="text-brand underline underline-offset-2 focus-ring">
                          Pedírselo desde aquí
                        </button>
                        .
                      </>
                    ) : (
                      "Pide al Comité de Jueces que te ponga una nueva desde «Usuarios»."
                    )}
                  </p>
                )}
              </>
            )}

            {modo === "juez" && vistaJuez === "codigo" && (
              <>
                <h1 className="text-base font-semibold text-foreground">Entrar con un código</h1>
                <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
                  Escribe el e-mail de tu ficha y el código que te ha dado tu delegado, y crea tu contraseña. Con ella
                  entrarás a partir de ahora.
                </p>
                <form onSubmit={(e) => void redeem(e)} className="mt-5 space-y-3">
                  <div>
                    <label htmlFor="code-email" className={labelClass}>
                      Tu e-mail
                    </label>
                    <input id="code-email" type="email" placeholder="nombre@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="code" className={labelClass}>
                      Código
                    </label>
                    <input
                      id="code"
                      type="text"
                      placeholder="K7QM-4TZP"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      spellCheck={false}
                      className={`${inputClass} font-mono uppercase tracking-wide`}
                    />
                  </div>
                  <div>
                    <label htmlFor="new-password" className={labelClass}>
                      Contraseña nueva
                    </label>
                    <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" aria-describedby="new-password-hint" className={inputClass} />
                    <p id="new-password-hint" className="mt-1 text-xs text-muted-foreground">
                      Al menos 8 caracteres.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="new-password-2" className={labelClass}>
                      Repite la contraseña
                    </label>
                    <input id="new-password-2" type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} required minLength={8} autoComplete="new-password" className={inputClass} />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground ${submitClass}`}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Crear contraseña y entrar
                  </button>
                </form>
                <div className="mt-3 flex flex-wrap gap-x-4">
                  <button type="button" onClick={() => { setVistaJuez("entrar"); resetAvisos(); }} className={linkClass}>
                    Ya tengo contraseña
                  </button>
                  <button type="button" onClick={() => { setVistaJuez("pedir"); resetAvisos(); }} className={linkClass}>
                    No tengo código
                  </button>
                </div>
              </>
            )}

            {modo === "juez" && vistaJuez === "pedir" && (
              <>
                <h1 className="text-base font-semibold text-foreground">Pedir acceso</h1>
                <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
                  Escribe el e-mail de tu ficha del censo. Tu delegado de zona verá la petición en la aplicación y te
                  dará un código para entrar.
                </p>
                <form onSubmit={(e) => void requestCode(e)} className="mt-5 space-y-3">
                  <div>
                    <label htmlFor="request-email" className={labelClass}>
                      Tu e-mail
                    </label>
                    <input id="request-email" type="email" placeholder="nombre@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground ${submitClass}`}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Pedir un código
                  </button>
                </form>
                <div className="mt-3 flex flex-wrap gap-x-4">
                  <button type="button" onClick={() => { setVistaJuez("codigo"); resetAvisos(); }} className={linkClass}>
                    Ya tengo un código
                  </button>
                  <button type="button" onClick={() => { setVistaJuez("entrar"); resetAvisos(); }} className={linkClass}>
                    Ya tengo contraseña
                  </button>
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
