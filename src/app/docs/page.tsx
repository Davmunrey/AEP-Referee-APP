import Link from "next/link";
import { TarimaManualDownloadButton } from "@/components/docs/tarima-manual-download";
import Image from "next/image";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Database,
  KeyRound,
  LayoutGrid,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Documentación y privacidad · AEP Tarima",
  description:
    "Guía de uso, funciones, roles, política de privacidad y protección de datos de AEP Tarima, la plataforma de gestión de jueces de la Asociación Española de Powerlifting.",
};

// Renderizar según sesión: lo externo es público; la guía operativa interna
// solo se muestra a usuarios autenticados.
export const dynamic = "force-dynamic";

const updated = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });

type TocItem = { id: string; label: string; internal?: boolean };

// Secciones en orden de página. Las marcadas `internal` (guía operativa) solo
// se muestran a usuarios autenticados; el resto es público (externo + legal).
const tocSections: TocItem[] = [
  { id: "que-es", label: "Qué es AEP Tarima" },
  { id: "funciones", label: "Funciones principales" },
  { id: "uso", label: "Guía de uso paso a paso", internal: true },
  { id: "tarima", label: "Flujo de la tarima", internal: true },
  { id: "roles", label: "Roles y permisos", internal: true },
  { id: "niveles", label: "Niveles arbitrales" },
  { id: "faq", label: "Preguntas frecuentes", internal: true },
  { id: "privacidad", label: "Privacidad y datos" },
  { id: "seguridad", label: "Seguridad" },
  { id: "cookies", label: "Cookies y sesión" },
  { id: "terminos", label: "Condiciones de uso" },
  { id: "contacto", label: "Contacto" },
];

type Icon = React.ComponentType<{ className?: string }>;

function Section({
  id,
  icon: IconCmp,
  title,
  children,
}: {
  id: string;
  icon: Icon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IconCmp className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function FeatureCard({ icon: IconCmp, title, desc }: { icon: Icon; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <IconCmp className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-10">
      <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {n}
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </li>
  );
}

function FlowStep({ icon: IconCmp, label }: { icon: Icon; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-4 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <IconCmp className="h-5 w-5" />
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </div>
  );
}

export default async function DocsPage() {
  const user = await getSession();
  const isAuthenticated = Boolean(user);
  const toc = tocSections.filter((s) => isAuthenticated || !s.internal);
  const backHref = isAuthenticated ? "/" : "/sign-in";
  const backLabel = isAuthenticated ? "Volver a la app" : "Volver al acceso";

  return (
    <div className="min-h-screen bg-background">
      {/* Cabecera */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/aep-master-logo.png"
              alt="Asociación Española de Powerlifting"
              width={140}
              height={38}
              className="h-8 w-auto"
            />
            <span className="hidden text-sm font-semibold text-foreground sm:inline">
              Documentación
            </span>
          </div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {backLabel}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-4xl px-6 py-12 text-center">
          <Image
            src="/assets/aep-mark.png"
            alt=""
            width={64}
            height={64}
            className="mx-auto h-14 w-auto"
          />
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
            AEP Tarima — Documentación
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Plataforma de gestión de jueces de la Asociación Española de Powerlifting:
            censo arbitral, tarimas, aprobaciones, exámenes, ascensos y analítica.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Web
            </span>
            <span className="text-subtle-muted">Actualizado: {updated}</span>
          </div>
          {isAuthenticated && <TarimaManualDownloadButton className="mt-4" />}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Índice */}
        <nav aria-label="Índice" className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle-muted">Índice</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                >
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 space-y-12">
          <Section id="que-es" icon={BookOpen} title="Qué es AEP Tarima">
            <p>
              AEP Tarima es la herramienta interna de la AEP para organizar el arbitraje de las
              competiciones de powerlifting. Centraliza el censo de jueces, la planificación de
              las tarimas (cuadrantes de cada sesión), las aprobaciones del Comité, los exámenes,
              los ascensos de nivel, las sanciones y los informes. El acceso está restringido a
              cuentas autorizadas por el Comité de Jueces.
            </p>
          </Section>

          <Section id="funciones" icon={LayoutGrid} title="Funciones principales">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard icon={BarChart3} title="Panel de inicio" desc="KPIs de cobertura, salud operativa, avisos y próximos campeonatos de un vistazo." />
              <FeatureCard icon={CalendarDays} title="Campeonatos" desc="Alta y edición de competiciones, sesiones, sede y plazas requeridas." />
              <FeatureCard icon={LayoutGrid} title="Tarima (cuadrante)" desc="Asignación de jueces por plaza, control de cobertura y envío a aprobación." />
              <FeatureCard icon={Building2} title="Compensación" desc="Panel central, km manual, desglose por posición en tarima, montaje sistema y recibos PDF." />
              <FeatureCard icon={Users} title="Censo de jueces" desc="Ficha por juez con nivel, zona, domicilio, exámenes, informes y sanciones." />
              <FeatureCard icon={ClipboardCheck} title="Aprobaciones y ascensos" desc="Revisión por el Comité de Jueces de tarimas y solicitudes de ascenso." />
              <FeatureCard icon={TrendingUp} title="Analítica" desc="Estadísticas por zona, top de jueces y tasa de rechazo por año." />
            </div>
          </Section>

          {isAuthenticated ? (
          <>
          <Section id="uso" icon={BookOpen} title="Guía de uso paso a paso">
            <ol className="space-y-5">
              <Step n={1} title="Inicia sesión">
                Accede con tu correo y contraseña autorizados. ¿Olvidaste la contraseña? Usa el
                enlace de recuperación.
              </Step>
              <Step n={2} title="Revisa el panel de inicio">
                El Dashboard resume la cobertura global, la salud operativa, los avisos y los
                campeonatos próximos. Es tu punto de partida diario.
              </Step>
              <Step n={3} title="Crea o abre un campeonato">
                En «Campeonatos», crea uno nuevo (tipo AEP-1/2/3, sede, fechas, sesiones y plazas)
                o abre uno existente para ver su detalle.
              </Step>
              <Step n={4} title="Construye la tarima">
                En el detalle del campeonato, abre la Tarima y asigna un juez a cada plaza (toca la
                plaza y elige al juez). El indicador de cobertura te muestra el % completado.
              </Step>
              <Step n={5} title="Envía a aprobación">
                Cuando la tarima esté completa, envíala al Comité de Jueces para su revisión.
              </Step>
              <Step n={6} title="Gestiona el censo">
                En «Jueces», da de alta o edita fichas y registra exámenes, informes y sanciones.
                El delegado de zona trabaja sobre los jueces de su zona.
              </Step>
            </ol>
          </Section>

          <Section id="tarima" icon={LayoutGrid} title="Flujo de la tarima">
            <p>El ciclo de vida de una tarima sigue cuatro pasos:</p>
            <div className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <FlowStep icon={CalendarDays} label="1. Crear campeonato" />
              <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-subtle-muted sm:rotate-0" aria-hidden="true" />
              <FlowStep icon={Users} label="2. Asignar jueces" />
              <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-subtle-muted sm:rotate-0" aria-hidden="true" />
              <FlowStep icon={ClipboardCheck} label="3. Enviar a aprobación" />
              <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-subtle-muted sm:rotate-0" aria-hidden="true" />
              <FlowStep icon={CheckCircle2} label="4. Aprobado por el Comité" />
            </div>
          </Section>

          <Section id="roles" icon={ShieldCheck} title="Roles y permisos">
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-subtle-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Rol</th>
                    <th className="px-4 py-2.5 font-medium">Puede</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-foreground">Super Admin</td>
                    <td className="px-4 py-2.5 text-muted-foreground">Acceso total; gestiona usuarios; aprueba tarimas y ascensos.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-foreground">Comité de Jueces</td>
                    <td className="px-4 py-2.5 text-muted-foreground">Igual que Super Admin a efectos operativos; aprueba a nivel nacional.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-foreground">Delegado de Zona</td>
                    <td className="px-4 py-2.5 text-muted-foreground">Gestiona competiciones y jueces de su zona; solicita ascensos.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-foreground">Responsable Financiero</td>
                    <td className="px-4 py-2.5 text-muted-foreground">Panel de compensación, km y recibos PDF; lectura de tarimas y censo.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-foreground">Solo lectura</td>
                    <td className="px-4 py-2.5 text-muted-foreground">Consulta la información sin poder modificarla.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-subtle-muted">
              Los permisos se aplican y revalidan en el servidor en cada operación.
            </p>
          </Section>
          </>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-3 text-base font-semibold text-foreground">
                Guía de uso para personal autorizado
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                La guía paso a paso, el flujo de la tarima, los roles y permisos y las preguntas
                frecuentes operativas están disponibles para las cuentas autorizadas por el Comité
                de Jueces. Inicia sesión para consultarlas.
              </p>
              <Link
                href="/sign-in"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Iniciar sesión
              </Link>
            </div>
          )}

          <Section id="niveles" icon={Award} title="Niveles arbitrales">
            <div className="flex flex-wrap gap-2">
              {["Regional", "Nacional", "IPF Cat. 2", "IPF Cat. 1"].map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
                >
                  <Award className="h-3.5 w-3.5 text-primary" /> {n}
                </span>
              ))}
            </div>
            <p>
              Cada plaza de la tarima exige un nivel mínimo según el tipo de competición y el rol
              (central, lateral, jurado…), conforme a la normativa IPF recogida en la sección de
              Normativa de la aplicación.
            </p>
          </Section>

          {isAuthenticated && (
          <Section id="faq" icon={BookOpen} title="Preguntas frecuentes">
            <div className="space-y-2">
              {[
                {
                  q: "¿Cómo recupero mi contraseña?",
                  a: "Desde la pantalla de acceso, pulsa «¿Olvidaste tu contraseña?» e introduce tu correo; recibirás un enlace para restablecerla.",
                },
                {
                  q: "¿Por qué no puedo editar un campeonato de otra zona?",
                  a: "Los delegados de zona solo gestionan los datos de su propia zona. El Comité de Jueces tiene alcance nacional.",
                },
                {
                  q: "¿Cómo se sanciona a un juez?",
                  a: "Desde la ficha del juez, en la sección «Sanciones», indicando motivo, fecha de inicio y duración. El delegado de zona puede hacerlo en su zona.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-border bg-card p-4"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
                    {item.q}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </Section>
          )}

          <Section id="privacidad" icon={Database} title="Privacidad y protección de datos">
            <p>
              <strong>Responsable del tratamiento:</strong> Asociación Española de Powerlifting (AEP).
            </p>
            <p>
              <strong>Datos tratados:</strong> datos identificativos y de contacto de los jueces
              (nombre, correo, teléfono, localidad, número de licencia), datos federativos (zona,
              nivel arbitral, historial de eventos, exámenes, ascensos y sanciones) y datos de las
              cuentas de acceso.
            </p>
            <p>
              <strong>Finalidad:</strong> organizar el arbitraje de las competiciones y mantener el
              censo y la trazabilidad de la actividad arbitral de la federación.
            </p>
            <p>
              <strong>Base jurídica:</strong> interés legítimo y relación federativa entre la AEP y
              sus jueces, y cumplimiento de las obligaciones organizativas de la federación.
            </p>
            <p>
              <strong>Conservación:</strong> mientras se mantenga la vinculación federativa y durante
              los plazos legalmente exigibles.
            </p>
            <p>
              <strong>Destinatarios:</strong> proveedores de infraestructura (Supabase y Vercel) como
              encargados del tratamiento. No se ceden a terceros salvo obligación legal.
            </p>
            <p>
              <strong>Derechos:</strong> acceso, rectificación, supresión, oposición, limitación y
              portabilidad, escribiendo al Comité de Jueces (ver
              {" "}<a href="#contacto" className="text-primary hover:underline">Contacto</a>).
            </p>
            <p>
              <strong>Reclamaciones:</strong> si consideras que el tratamiento de tus datos no se
              ajusta a la normativa, puedes presentar una reclamación ante la Agencia Española de
              Protección de Datos (AEPD,
              {" "}<a
                href="https://www.aepd.es"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >www.aepd.es</a>).
            </p>
            <p className="text-xs text-subtle-muted">
              Última actualización: {updated}.
            </p>
          </Section>

          <Section id="seguridad" icon={Lock} title="Seguridad">
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                { icon: Lock, t: "Cifrado HTTPS/TLS en todo el tráfico." },
                { icon: ShieldCheck, t: "Control por rol y zona revalidado en el servidor." },
              ].map((it) => (
                <li key={it.t} className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
                  <it.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">{it.t}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="cookies" icon={ShieldCheck} title="Cookies y sesión">
            <p>
              La aplicación usa exclusivamente cookies técnicas necesarias para mantener la sesión
              iniciada (gestionadas por el proveedor de autenticación). No se usan cookies
              publicitarias ni de seguimiento de terceros.
            </p>
          </Section>

          <Section id="terminos" icon={ClipboardCheck} title="Condiciones de uso">
            <p>
              El acceso está limitado a personas autorizadas por la AEP. El uso de la plataforma y
              de la información debe ceñirse a las funciones arbitrales y organizativas de la
              federación. Queda prohibido el uso no autorizado, la extracción masiva de datos o
              cualquier acción que comprometa la seguridad o la confidencialidad.
            </p>
          </Section>

          <Section id="contacto" icon={Building2} title="Contacto">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Para consultas sobre la plataforma o el tratamiento de tus datos, contacta con el
                <strong> Comité de Jueces de la Asociación Española de Powerlifting</strong> a través
                de los canales oficiales de la federación.
              </p>
            </div>
          </Section>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 border-t border-border pt-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
          <p className="text-center text-xs text-subtle-muted">
            © {new Date().getFullYear()} Asociación Española de Powerlifting · AEP Tarima
          </p>
        </div>
      </main>
    </div>
  );
}
