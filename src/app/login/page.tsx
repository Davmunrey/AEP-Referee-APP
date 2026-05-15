import { Suspense } from "react";
import { DemoPersonaPicker } from "@/components/auth/demo-persona-picker";
import { LoginForm } from "@/components/auth/login-form";
import { AepLogo } from "@/components/aep/logo";
import { DEMO_PERSONAS, isDemoMode } from "@/lib/auth/demo";
import { Shield, Sparkles } from "lucide-react";

export default function LoginPage() {
  const demoEnabled = isDemoMode();

  return (
    <div className="app-mesh relative flex min-h-screen">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative hidden w-[44%] max-w-xl flex-col justify-between border-r border-border-muted p-12 lg:flex">
        <AepLogo collapsed={false} />
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground-secondary">
            <Sparkles className="h-3.5 w-3.5 text-warning" />
            Panel federativo 2026
          </div>
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight text-gradient-brand">
            Gestión arbitral, clara y en tiempo real
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Tarimas, aprobaciones y directorio de árbitros en un solo lugar. Diseñado para
            responsables nacionales y regionales de la AEP.
          </p>
          <ul className="space-y-3 text-sm text-subtle-muted">
            <li className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Validación IPF en cada designación
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success/20 text-[10px] text-success">
                ✓
              </span>
              Flujos de aprobación por zona
            </li>
          </ul>
        </div>
        <p className="font-mono text-[10px] text-subtle-muted">AEP · Powerlifting España</p>
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 w-full max-w-md lg:hidden">
          <AepLogo collapsed={false} className="justify-center" />
        </div>
        <div className="glass-panel w-full max-w-md rounded-3xl p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-foreground">Bienvenido</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {demoEnabled
                ? "Elige tu plataforma para explorar la demo"
                : "Inicia sesión en tu cuenta AEP"}
            </p>
          </div>
          {demoEnabled ? (
            <Suspense fallback={<p className="text-center text-sm text-subtle-muted">Cargando…</p>}>
              <DemoPersonaPicker personas={DEMO_PERSONAS} />
            </Suspense>
          ) : (
            <Suspense fallback={<p className="text-center text-sm text-subtle-muted">Cargando…</p>}>
              <LoginForm />
            </Suspense>
          )}
          {demoEnabled && (
            <details className="mt-6 border-t border-border-muted pt-6">
              <summary className="cursor-pointer text-center text-xs text-subtle-muted transition-colors hover:text-foreground-secondary">
                Acceso con email y contraseña
              </summary>
              <div className="mt-4">
                <Suspense fallback={null}>
                  <LoginForm />
                </Suspense>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
