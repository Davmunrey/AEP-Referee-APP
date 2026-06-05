import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentación y privacidad · AEP Tarima",
  description:
    "Documentación de uso, política de privacidad y protección de datos de AEP Tarima, la plataforma de gestión de jueces de la Asociación Española de Powerlifting.",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

const updated = "junio de 2026";

export default function DocsPage() {
  const toc: Array<{ id: string; label: string }> = [
    { id: "que-es", label: "Qué es AEP Tarima" },
    { id: "uso", label: "Guía de uso" },
    { id: "roles", label: "Roles y permisos" },
    { id: "privacidad", label: "Privacidad y protección de datos" },
    { id: "seguridad", label: "Seguridad" },
    { id: "cookies", label: "Cookies y sesión" },
    { id: "terminos", label: "Condiciones de uso" },
    { id: "contacto", label: "Contacto" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/aep-master-logo.png"
              alt="Asociación Española de Powerlifting"
              width={140}
              height={38}
              className="h-8 w-auto"
            />
            <span className="text-sm font-semibold text-foreground">Documentación</span>
          </div>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Volver al acceso
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Documentación y privacidad
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Plataforma de gestión de jueces de la Asociación Española de Powerlifting (AEP).
          Última actualización: {updated}.
        </p>

        <nav aria-label="Índice" className="mt-6 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle-muted">
            Índice
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-sm text-primary underline-offset-2 hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 space-y-10">
          <Section id="que-es" title="Qué es AEP Tarima">
            <p>
              AEP Tarima es la herramienta interna de la AEP para organizar el arbitraje de las
              competiciones de powerlifting: gestión del censo de jueces, planificación de
              tarimas (cuadrantes), aprobaciones, exámenes, ascensos, sanciones e informes.
              El acceso está restringido a cuentas autorizadas por el Comité de Jueces.
            </p>
          </Section>

          <Section id="uso" title="Guía de uso">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong>Inicio:</strong> panel con indicadores de cobertura, salud operativa y avisos.</li>
              <li><strong>Campeonatos:</strong> alta y edición de competiciones y construcción de la tarima (asignación de jueces por plaza, envío a aprobación).</li>
              <li><strong>Jueces:</strong> censo con ficha individual (nivel, zona, exámenes, informes y sanciones).</li>
              <li><strong>Aprobaciones y ascensos:</strong> revisión por el Comité de Jueces.</li>
              <li><strong>Analítica y normativa:</strong> estadísticas por zona y requisitos IPF por rol.</li>
            </ul>
            <p>
              La plataforma está disponible como aplicación web y como app nativa de iOS, ambas
              conectadas a los mismos datos.
            </p>
          </Section>

          <Section id="roles" title="Roles y permisos">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong>Super Admin</strong> y <strong>Comité de Jueces</strong>: acceso completo; aprueban tarimas y ascensos y gestionan usuarios.</li>
              <li><strong>Delegado de Zona</strong>: gestiona competiciones y jueces de su zona.</li>
              <li><strong>Solo lectura</strong>: consulta sin modificar.</li>
            </ul>
            <p>El control de acceso se aplica y revalida en el servidor en cada operación.</p>
          </Section>

          <Section id="privacidad" title="Privacidad y protección de datos">
            <p>
              <strong>Responsable del tratamiento:</strong> Asociación Española de Powerlifting (AEP).
            </p>
            <p>
              <strong>Datos tratados:</strong> datos identificativos y de contacto de los jueces
              (nombre, correo electrónico, teléfono, localidad, número de licencia), datos
              federativos (zona, nivel arbitral, historial de eventos, exámenes, ascensos y
              sanciones) y datos de las cuentas de acceso. En la app móvil, si se activan, el
              token de notificaciones del dispositivo.
            </p>
            <p>
              <strong>Finalidad:</strong> organizar el arbitraje de las competiciones y mantener el
              censo y la trazabilidad de la actividad arbitral de la federación.
            </p>
            <p>
              <strong>Base jurídica:</strong> el interés legítimo y la relación federativa entre la
              AEP y sus jueces, así como el cumplimiento de las obligaciones organizativas de la
              federación.
            </p>
            <p>
              <strong>Conservación:</strong> los datos se conservan mientras se mantenga la
              vinculación federativa y durante los plazos legalmente exigibles.
            </p>
            <p>
              <strong>Destinatarios:</strong> los datos se alojan en proveedores de infraestructura
              (Supabase y Vercel) que actúan como encargados del tratamiento. No se ceden a terceros
              salvo obligación legal.
            </p>
            <p>
              <strong>Derechos:</strong> puedes ejercer tus derechos de acceso, rectificación,
              supresión, oposición, limitación y portabilidad escribiendo al Comité de Jueces de la
              AEP (ver <a href="#contacto" className="text-primary hover:underline">Contacto</a>).
            </p>
          </Section>

          <Section id="seguridad" title="Seguridad">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Todo el tráfico va cifrado por HTTPS/TLS.</li>
              <li>Autenticación gestionada por Supabase; las contraseñas no se almacenan en claro.</li>
              <li>En la app iOS, la sesión se guarda en el Llavero (Keychain) y puede protegerse con Face ID/Touch ID.</li>
              <li>El acceso a los datos aplica control por rol y por zona, revalidado en el servidor.</li>
              <li>Cabeceras de seguridad activas (HSTS, política de contenido, anti-clickjacking).</li>
            </ul>
          </Section>

          <Section id="cookies" title="Cookies y sesión">
            <p>
              La aplicación utiliza exclusivamente cookies técnicas necesarias para mantener la
              sesión iniciada (gestionadas por el proveedor de autenticación). No se usan cookies
              publicitarias ni de seguimiento de terceros.
            </p>
          </Section>

          <Section id="terminos" title="Condiciones de uso">
            <p>
              El acceso está limitado a personas autorizadas por la AEP. El uso de la plataforma
              y de la información contenida debe ceñirse a las funciones arbitrales y organizativas
              de la federación. Queda prohibido el uso no autorizado, la extracción masiva de datos
              o cualquier acción que comprometa la seguridad o la confidencialidad.
            </p>
          </Section>

          <Section id="contacto" title="Contacto">
            <p>
              Para cualquier consulta sobre la plataforma o sobre el tratamiento de tus datos,
              contacta con el <strong>Comité de Jueces de la Asociación Española de Powerlifting</strong>
              a través de los canales oficiales de la federación.
            </p>
          </Section>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-subtle-muted">
          © {new Date().getFullYear()} Asociación Española de Powerlifting · AEP Tarima
        </div>
      </main>
    </div>
  );
}
