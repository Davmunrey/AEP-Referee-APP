import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { ArrowLeft } from "lucide-react";
import { DocsChangelog } from "@/components/docs/docs-changelog";
import { REFEREE_LEVEL_ORDER } from "@/lib/referee-levels";

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
// Los id son públicos: otras pantallas enlazan a /docs#contacto, #privacidad y
// #roles, así que no se renombran.
const tocSections: TocItem[] = [
  { id: "que-es", label: "Qué es AEP Tarima" },
  { id: "funciones", label: "Funciones principales" },
  { id: "uso", label: "Guía de uso paso a paso", internal: true },
  { id: "tarima", label: "Flujo de la tarima", internal: true },
  { id: "roles", label: "Roles y permisos", internal: true },
  { id: "niveles", label: "Niveles arbitrales" },
  { id: "faq", label: "Preguntas frecuentes", internal: true },
  { id: "novedades", label: "Novedades", internal: true },
  { id: "privacidad", label: "Privacidad y datos" },
  { id: "seguridad", label: "Seguridad" },
  { id: "cookies", label: "Cookies y sesión" },
  { id: "terminos", label: "Condiciones de uso" },
  { id: "contacto", label: "Contacto" },
];

const features: { title: string; desc: string }[] = [
  { title: "Panel de inicio", desc: "KPIs de cobertura, salud operativa, avisos y próximos campeonatos de un vistazo." },
  { title: "Campeonatos", desc: "Alta y edición de competiciones, sesiones, sede y plazas requeridas." },
  { title: "Tarima (cuadrante)", desc: "Asignación de jueces por plaza, control de cobertura y envío a aprobación." },
  { title: "Compensación", desc: "Panel central, km manual, desglose por posición en tarima, montaje sistema y recibos PDF." },
  { title: "Censo de jueces", desc: "Ficha por juez con nivel, zona, domicilio, exámenes, informes y sanciones." },
  { title: "Aprobaciones y ascensos", desc: "Revisión por el Comité de Jueces de tarimas y solicitudes de ascenso." },
  { title: "Analítica", desc: "Estadísticas por zona, top de jueces y tasa de rechazo por año." },
];

const steps: { title: string; body: string }[] = [
  {
    title: "Inicia sesión",
    body: "Accede con tu correo y contraseña autorizados. ¿Olvidaste la contraseña? Pide una nueva a un administrador; los jueces, un código nuevo a su delegado.",
  },
  {
    title: "Revisa el panel de inicio",
    body: "El Dashboard resume la cobertura global, la salud operativa, los avisos y los campeonatos próximos. Es tu punto de partida diario.",
  },
  {
    title: "Crea o abre un campeonato",
    body: "En «Campeonatos», crea uno nuevo (tipo AEP-1/2/3, sede, fechas, sesiones y plazas) o abre uno existente para ver su detalle.",
  },
  {
    title: "Construye la tarima",
    body: "En el detalle del campeonato, abre la Tarima y asigna un juez a cada plaza (toca la plaza y elige al juez). El indicador de cobertura te muestra el % completado.",
  },
  {
    title: "Envía a aprobación",
    body: "Cuando la tarima esté completa, envíala al Comité de Jueces para su revisión.",
  },
  {
    title: "Gestiona el censo",
    body: "En «Jueces», da de alta o edita fichas y registra exámenes, informes y sanciones. El delegado de zona trabaja sobre los jueces de su zona.",
  },
];

const roles: { rol: string; puede: string }[] = [
  { rol: "Super Admin", puede: "Acceso total; gestiona usuarios; aprueba tarimas y ascensos." },
  { rol: "Comité de Jueces", puede: "Igual que Super Admin a efectos operativos; aprueba a nivel nacional." },
  { rol: "Delegado de Zona", puede: "Gestiona competiciones y jueces de su zona; solicita ascensos." },
  { rol: "Responsable Financiero", puede: "Panel de compensación, km y recibos PDF; lectura de tarimas y censo." },
  { rol: "Solo lectura", puede: "Consulta la información sin poder modificarla." },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "¿Cómo recupero mi contraseña?",
    a: "La aplicación no envía correos. En la gestión, un administrador te pone una nueva desde Usuarios. Si eres juez, tu delegado te da un código nuevo y con él creas otra en «Soy juez › Tengo un código».",
  },
  {
    q: "¿Por qué no puedo editar un campeonato de otra zona?",
    a: "Los delegados de zona solo gestionan los datos de su propia zona. El Comité de Jueces tiene alcance nacional.",
  },
  {
    q: "¿Cómo se sanciona a un juez?",
    a: "Desde la ficha del juez, en la sección «Sanciones», indicando motivo, fecha de inicio y duración. El delegado de zona puede hacerlo en su zona.",
  },
];

const linkClass = "rounded-sm text-brand underline underline-offset-2 hover:text-primary-hover focus-ring";

/**
 * Una sección de lectura: título y prosa a ~70 caracteres por línea. Sin
 * iconos ni tarjetas: es una página para leer, no un catálogo, y el índice
 * lateral ya da la orientación que antes intentaban dar los iconos.
 */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20">
      <h2 id={`${id}-titulo`} className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-title leading-relaxed text-foreground-secondary">{children}</div>
    </section>
  );
}

function TocList({ items }: { items: TocItem[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-ring"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function DocsPage() {
  // Esta página es pública y la sesión solo decide si se enseñan además las
  // secciones internas. Un fallo al leer el perfil se degrada a «anónimo», que
  // es el lado seguro: la documentación pública no se cae por eso, y las
  // secciones internas se quedan fuera hasta que la lectura vuelva.
  const user = await getSession().catch(() => null);
  const isAuthenticated = Boolean(user);
  const toc = tocSections.filter((s) => isAuthenticated || !s.internal);
  const backHref = isAuthenticated ? "/" : "/sign-in";
  const backLabel = isAuthenticated ? "Volver a la app" : "Volver al acceso";

  return (
    <div className="min-h-screen bg-background">
      {/* Cabecera opaca: con la prosa pasando por debajo, un fondo translúcido
          solo añadía ruido a la lectura. */}
      <header className="sticky top-0 z-(--z-sticky) border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/assets/aep-master-logo.png"
              alt="Asociación Española de Powerlifting"
              width={140}
              height={38}
              className="h-8 w-auto dark:hidden"
            />
            <Image
              src="/assets/aep-master-logo-light.png"
              alt="Asociación Española de Powerlifting"
              width={140}
              height={38}
              className="hidden h-8 w-auto dark:block"
            />
            <span className="hidden border-l border-border pl-3 text-sm font-medium text-foreground sm:inline">
              Documentación
            </span>
          </div>
          <Link
            href={backHref}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
        {/* Índice de escritorio: fijo al hacer scroll para saltar entre
            secciones sin volver arriba. */}
        <aside className="hidden lg:block">
          <nav aria-label="Índice" className="sticky top-20">
            <p className="px-2 text-sm font-semibold text-foreground">En esta página</p>
            <div className="mt-2">
              <TocList items={toc} />
            </div>
          </nav>
        </aside>

        <main className="min-w-0 max-w-prose">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">
            Documentación de AEP Tarima
          </h1>
          <p className="mt-3 text-base leading-relaxed text-foreground-secondary">
            Plataforma de gestión de jueces de la Asociación Española de Powerlifting: censo
            arbitral, tarimas, aprobaciones, exámenes, ascensos y analítica.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Actualizado en {updated}.</p>

          {/* Índice en móvil: plegado para no empujar el contenido una
              pantalla entera hacia abajo. */}
          <details className="group mt-6 rounded-lg border border-border bg-card lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm font-medium text-foreground focus-ring [&::-webkit-details-marker]:hidden">
              En esta página
              <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
            <nav aria-label="Índice" className="border-t border-border px-1 py-2">
              <TocList items={toc} />
            </nav>
          </details>

          <div className="mt-12 space-y-12">
            <Section id="que-es" title="Qué es AEP Tarima">
              <p>
                AEP Tarima es la herramienta interna de la AEP para organizar el arbitraje de las
                competiciones de powerlifting. Centraliza el censo de jueces, la planificación de
                las tarimas (cuadrantes de cada sesión), las aprobaciones del Comité, los
                exámenes, los ascensos de nivel, las sanciones y los informes. El acceso está
                restringido a cuentas autorizadas por el Comité de Jueces.
              </p>
            </Section>

            <Section id="funciones" title="Funciones principales">
              <dl className="divide-y divide-border-muted border-y border-border-muted">
                {features.map((f) => (
                  <div key={f.title} className="py-3 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-4">
                    <dt className="font-medium text-foreground">{f.title}</dt>
                    <dd className="mt-0.5 sm:mt-0">{f.desc}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            {isAuthenticated ? (
              <>
                <Section id="uso" title="Guía de uso paso a paso">
                  <ol className="list-decimal space-y-3 pl-5 marker:font-medium marker:text-muted-foreground">
                    {steps.map((s) => (
                      <li key={s.title} className="pl-1">
                        <strong className="font-semibold text-foreground">{s.title}.</strong> {s.body}
                      </li>
                    ))}
                  </ol>
                </Section>

                <Section id="tarima" title="Flujo de la tarima">
                  <p>El ciclo de vida de una tarima sigue cuatro pasos:</p>
                  <ol className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">
                    <li className="pl-1">Crear el campeonato.</li>
                    <li className="pl-1">Asignar jueces a cada plaza.</li>
                    <li className="pl-1">Enviar la tarima a aprobación.</li>
                    <li className="pl-1">El Comité de Jueces la aprueba.</li>
                  </ol>
                </Section>

                <Section id="roles" title="Roles y permisos">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border text-muted-foreground">
                        <tr>
                          <th scope="col" className="py-2 pr-4 font-medium">Rol</th>
                          <th scope="col" className="py-2 font-medium">Puede</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-muted">
                        {roles.map((r) => (
                          <tr key={r.rol}>
                            <th scope="row" className="whitespace-nowrap py-2.5 pr-4 align-top font-medium text-foreground">
                              {r.rol}
                            </th>
                            <td className="py-2.5 text-foreground-secondary">{r.puede}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Los permisos se aplican y revalidan en el servidor en cada operación.
                  </p>
                </Section>
              </>
            ) : (
              <section aria-labelledby="guia-privada-titulo" className="border-y border-border-muted py-6">
                <h2 id="guia-privada-titulo" className="text-base font-semibold text-foreground">
                  Guía de uso para personal autorizado
                </h2>
                <p className="mt-1.5 text-title leading-relaxed text-foreground-secondary">
                  La guía paso a paso, el flujo de la tarima, los roles y permisos y las preguntas
                  frecuentes operativas están disponibles para las cuentas autorizadas por el
                  Comité de Jueces. Inicia sesión para consultarlas.
                </p>
                <Link
                  href="/sign-in"
                  className="mt-4 inline-flex min-h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-ring focus-visible:ring-offset-2"
                >
                  Iniciar sesión
                </Link>
              </section>
            )}

            <Section id="niveles" title="Niveles arbitrales">
              <p>
                De menor a mayor: {REFEREE_LEVEL_ORDER.join(", ")}.
              </p>
              <p>
                Cada plaza de la tarima exige un nivel mínimo según el tipo de competición y el
                rol (central, lateral, jurado…), conforme a la normativa IPF recogida en la
                sección de Normativa de la aplicación (Guía AEP, plazas en tarima y reglamento
                IPF).
              </p>
            </Section>

            {isAuthenticated && (
              <Section id="faq" title="Preguntas frecuentes">
                <div className="divide-y divide-border-muted border-y border-border-muted">
                  {faqs.map((item) => (
                    <details key={item.q} className="group">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 font-medium text-foreground focus-ring [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <span aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90">
                          ›
                        </span>
                      </summary>
                      <p className="pb-3">{item.a}</p>
                    </details>
                  ))}
                </div>
              </Section>
            )}

            {isAuthenticated && (
              <Section id="novedades" title="Novedades">
                <p>
                  Qué ha cambiado en cada versión desplegada de AEP Tarima, de la más reciente a la
                  primera. La última versión aparece desplegada; el resto se puede expandir.
                </p>
                <DocsChangelog />
              </Section>
            )}

            <Section id="privacidad" title="Privacidad y protección de datos">
              <dl className="space-y-3">
                <div>
                  <dt className="font-semibold text-foreground">Responsable del tratamiento</dt>
                  <dd>Asociación Española de Powerlifting (AEP).</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Datos tratados</dt>
                  <dd>
                    Datos identificativos y de contacto de los jueces (nombre, correo, teléfono,
                    localidad, número de licencia), datos federativos (zona, nivel arbitral,
                    historial de eventos, exámenes, ascensos y sanciones) y datos de las cuentas de
                    acceso.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Finalidad</dt>
                  <dd>
                    Organizar el arbitraje de las competiciones y mantener el censo y la
                    trazabilidad de la actividad arbitral de la federación.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Base jurídica</dt>
                  <dd>
                    Interés legítimo y relación federativa entre la AEP y sus jueces, y
                    cumplimiento de las obligaciones organizativas de la federación.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Conservación</dt>
                  <dd>
                    Mientras se mantenga la vinculación federativa y durante los plazos legalmente
                    exigibles.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Destinatarios</dt>
                  <dd>
                    Proveedores de infraestructura (Supabase y Vercel) como encargados del
                    tratamiento. No se ceden a terceros salvo obligación legal.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Derechos</dt>
                  <dd>
                    Acceso, rectificación, supresión, oposición, limitación y portabilidad,
                    escribiendo al Comité de Jueces (ver{" "}
                    <a href="#contacto" className={linkClass}>
                      Contacto
                    </a>
                    ).
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Reclamaciones</dt>
                  <dd>
                    Si consideras que el tratamiento de tus datos no se ajusta a la normativa,
                    puedes presentar una reclamación ante la Agencia Española de Protección de
                    Datos (AEPD,{" "}
                    <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className={linkClass}>
                      www.aepd.es
                    </a>
                    ).
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-muted-foreground">Última actualización: {updated}.</p>
            </Section>

            <Section id="seguridad" title="Seguridad">
              <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
                <li className="pl-1">Cifrado HTTPS/TLS en todo el tráfico.</li>
                <li className="pl-1">Control por rol y zona revalidado en el servidor.</li>
              </ul>
            </Section>

            <Section id="cookies" title="Cookies y sesión">
              <p>
                La aplicación usa exclusivamente cookies técnicas necesarias para mantener la
                sesión iniciada (gestionadas por el proveedor de autenticación). No se usan cookies
                publicitarias ni de seguimiento de terceros.
              </p>
            </Section>

            <Section id="terminos" title="Condiciones de uso">
              <p>
                El acceso está limitado a personas autorizadas por la AEP. El uso de la plataforma
                y de la información debe ceñirse a las funciones arbitrales y organizativas de la
                federación. Queda prohibido el uso no autorizado, la extracción masiva de datos o
                cualquier acción que comprometa la seguridad o la confidencialidad.
              </p>
            </Section>

            <Section id="contacto" title="Contacto">
              <p>
                Para consultas sobre la plataforma o el tratamiento de tus datos, contacta con el{" "}
                <strong className="font-semibold text-foreground">
                  Comité de Jueces de la Asociación Española de Powerlifting
                </strong>{" "}
                a través de los canales oficiales de la federación.
              </p>
            </Section>
          </div>

          <footer className="mt-16 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Asociación Española de Powerlifting · AEP Tarima</p>
            <Link href={backHref} className={`inline-flex items-center gap-1.5 ${linkClass}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {backLabel}
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
