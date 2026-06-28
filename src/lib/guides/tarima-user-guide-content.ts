export interface GuideSection {
  title: string;
  intro?: string;
  steps: GuideStep[];
}

export interface GuideStep {
  id: string;
  title: string;
  body: string[];
  substeps?: { title: string; body: string[] }[];
}

export const TARIMA_GUIDE_META = {
  title: "Gestión de Jueces AEP Tarima",
  subtitle: "Manual de uso de la plataforma de arbitraje",
  association: "ASOCIACIÓN ESPAÑOLA DE POWERLIFTING (AEP)",
  updatedAt: "28 de junio de 2026",
  contactEmail: "powerhispania@gmail.com",
} as const;

export function tarimaGuideAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://tarima.powerliftingspain.es";
}

export function buildTarimaUserGuideSections(appUrl: string): GuideSection[] {
  return [
    {
      title: "CREAR TU USUARIO Y ACCEDER A AEP TARIMA",
      intro:
        "El acceso a AEP Tarima es solo por invitación. No hay registro público: el Comité de Jueces crea las cuentas autorizadas.",
      steps: [
        {
          id: "1.1",
          title: "Entrar en la plataforma",
          body: [
            `Abre la página de acceso: ${appUrl}/sign-in`,
            "Introduce el correo electrónico y la contraseña que te haya facilitado AEP Nacional o tu delegado de zona.",
          ],
        },
        {
          id: "1.2",
          title: "Recuperar contraseña",
          body: [
            "Si no recuerdas la contraseña, pulsa «¿Olvidaste tu contraseña?» en la pantalla de acceso.",
            "También puede resetearla un administrador desde Usuarios (icono de llave).",
          ],
        },
        {
          id: "1.3",
          title: "Cambiar tu contraseña",
          body: [
            "Una vez dentro, abre el menú de tu usuario en la esquina superior derecha (topbar) y elige «Cambiar contraseña».",
            "La nueva contraseña debe tener al menos 8 caracteres.",
          ],
        },
        {
          id: "1.4",
          title: "Documentación y manual PDF",
          body: [
            `Menú lateral → Documentación, o directamente ${appUrl}/docs.`,
            "Desde esa página puedes descargar este manual en PDF (requiere sesión).",
          ],
        },
      ],
    },
    {
      title: "PANEL DE INICIO (DASHBOARD)",
      steps: [
        {
          id: "2.1",
          title: "Resumen operativo",
          body: [
            "Al iniciar sesión verás el panel de inicio con KPIs: jueces activos, próximas competiciones, plazas sin cubrir, aprobaciones pendientes y cobertura nacional.",
            "La «Salud operativa» resume el estado global (0–100) según cobertura, urgencia y disponibilidad.",
            "Las recomendaciones priorizan avisos críticos. El panel se actualiza en vivo; puedes pausarlo con el botón correspondiente.",
          ],
        },
        {
          id: "2.2",
          title: "Atajos rápidos",
          body: [
            "Desde la cabecera accede a Jueces, Aprobaciones, Exportar datos o crear un Nuevo campeonato.",
          ],
        },
      ],
    },
    {
      title: "CAMPEONATOS",
      steps: [
        {
          id: "3.1",
          title: "Listado y filtros",
          body: [
            "Menú lateral → Campeonatos. Verás tarimas abiertas (priorizadas por cobertura pendiente) y la tabla completa con búsqueda y filtros por tipo (AEP-1/2/3), zona y estado.",
          ],
        },
        {
          id: "3.2",
          title: "Crear campeonato",
          body: [
            "Pulsa «+ Nuevo campeonato» o importa el calendario anual AEP (PDF/CSV) con «Importar calendario AEP».",
            "Indica nombre, tipo, fechas, sede, zona, sesiones y plazas requeridas.",
          ],
        },
        {
          id: "3.3",
          title: "Abrir tarima",
          body: [
            "En cada fila usa «Montar tarima» o el icono de cuadrante PDF para exportar directamente si la plantilla ya existe.",
          ],
        },
      ],
    },
    {
      title: "TARIMA — PLANTILLA Y ASIGNACIÓN",
      steps: [
        {
          id: "4.1",
          title: "Crear la plantilla",
          body: [
            "Al abrir un campeonato sin plantilla, el flujo guía tres pasos: Plantilla → Asignación → Revisión.",
          ],
          substeps: [
            {
              title: "Importar horario (PDF)",
              body: [
                "Sube el horario oficial AEP. La app detecta sesiones, categorías y horarios.",
                "Revisa la vista previa y guarda la plantilla.",
              ],
            },
            {
              title: "Plantilla manual",
              body: ["Alternativamente, crea sesiones y plazas a mano desde «Crear plantilla manual»."],
            },
          ],
        },
        {
          id: "4.2",
          title: "Asignar jueces",
          body: [
            "En la pestaña Asignación: panel izquierdo (jueces disponibles) y derecho (sesiones y plazas).",
            "Puedes arrastrar, hacer clic en plaza + juez, o importar un cuadrante PDF oficial (Plantilla ▾ → Importar cuadrante).",
            "Filtra por zona, nivel, búsqueda y «solo confirmados» (disponibilidad).",
            "El sistema avisa de huecos, solapes y cruces de zona. Guarda borrador o envía a aprobación.",
          ],
        },
        {
          id: "4.3",
          title: "Tarima aprobada e imprevistos",
          body: [
            "Si la tarima está aprobada, queda bloqueada. Para cambios de última hora: «Registrar imprevisto» en la cabecera.",
            "Modifica lo necesario y vuelve a enviar a aprobación.",
          ],
        },
      ],
    },
    {
      title: "EXPORTAR CUADRANTE",
      steps: [
        {
          id: "5.1",
          title: "Formatos disponibles",
          body: [
            "Desde Exportar ▾ en la tarima (o icono PDF en el listado):",
            "· Cuadrante PDF — formato oficial AEP, listo para imprimir o guardar.",
            "· Cuadrante Excel — una hoja por día.",
            "· Acta en texto y compartir resumen por WhatsApp.",
          ],
        },
      ],
    },
    {
      title: "COMPENSACIÓN DE GASTOS (RESPONSABLE FINANCIERO)",
      intro:
        "Rol responsable_financiero_jueces o super_admin. Gestiona la compensación económica sin editar tarima ni censo. Kilometraje 100 % gratuito vía OpenStreetMap (Photon + Nominatim + OSRM).",
      steps: [
        {
          id: "6.0",
          title: "Panel central (/compensation)",
          body: [
            "Menú lateral → Compensación. Lista todos los campeonatos con jueces asignados, km pendientes y enlace «Abrir» a cada compensación.",
            "Evita ir campeonato a campeonato desde la tarima.",
          ],
        },
        {
          id: "6.1",
          title: "Acceder a compensación",
          body: [
            "Desde el panel central o desde la tarima → Compensación (/competitions/[id]/compensation).",
            "Configura clubes organizadores y e-mails de devolución del recibo.",
          ],
        },
        {
          id: "6.2",
          title: "Organizadores del recibo",
          body: [
            "Puedes indicar varios clubes organizadores y varios e-mails de devolución.",
            "El listado de clubes se autocompleta con el censo oficial AEP (180 clubes, abril 2026).",
            "También puedes elegir AEP nacional como organizador.",
          ],
        },
        {
          id: "6.3",
          title: "Kilometraje manual",
          body: [
            "Introduce los km ida+vuelta (enteros) manualmente por cada juez en la tabla de compensación.",
            "No se calculan automáticamente desde la sede del campeonato.",
          ],
        },
        {
          id: "6.4",
          title: "Comparte, montaje y desglose por sesión",
          body: [
            "Marca «Comparte» si el juez viaja en vehículo compartido: solo exime el cobro de kilometraje; el alojamiento sigue aplicando según los km.",
            "Marca «Mont.» si el juez monta el sistema informático (Liftingcast, OpenLifter o Goodlift) e introduce el importe que se paga.",
            "Esto es distinto de ocupar la posición ordenador en tarima: esa función sale del cuadrante como cualquier otra plaza.",
            "El desglose agrupa por sesión Sx mostrando la posición real en tarima (Central, Lateral, Pesaje…).",
            "Los importes de viaje y alojamiento no se confirman hasta completar todos los km.",
          ],
        },
        {
          id: "6.5",
          title: "Exportar recibo PDF",
          body: [
            "El botón Recibo solo se activa cuando el juez tiene todos los datos completos.",
            "Introduce el IBAN español en el modal (no se guarda en la app, solo en el PDF generado).",
            "El PDF incluye el desglose de compensación según normativa AEP.",
          ],
        },
      ],
    },
    {
      title: "DIRECTORIO DE JUECES",
      steps: [
        {
          id: "7.1",
          title: "Censo y ficha",
          body: [
            "Menú → Directorio. Búsqueda y filtros por zona, nivel y estado.",
            "La ficha incluye domicilio (para km), historial por campeonato, sanciones, exámenes, informes y ascensos.",
          ],
        },
        {
          id: "7.2",
          title: "Importación masiva",
          body: [
            "AEP Nacional puede importar el Excel maestro del registro de jueces (Importar Excel maestro).",
            "También es posible el alta individual con «+ Nuevo juez».",
          ],
        },
      ],
    },
    {
      title: "APROBACIONES, ASCENSOS, EXÁMENES E INFORMES",
      steps: [
        {
          id: "8.1",
          title: "Aprobaciones",
          body: ["Las tarimas enviadas esperan revisión del Comité en Aprobaciones."],
        },
        {
          id: "8.2",
          title: "Ascensos",
          body: ["Solicitud y revisión de cambios de categoría arbitral."],
        },
        {
          id: "8.3",
          title: "Exámenes",
          body: ["Registro de exámenes: nuevo juez, ascenso IPF, recertificación."],
        },
        {
          id: "8.4",
          title: "Informes",
          body: [
            "Informes por juez o por competición. El delegado de zona ve solo su zona; nacional ve todo.",
          ],
        },
      ],
    },
    {
      title: "ESTADÍSTICAS Y NORMATIVA",
      steps: [
        {
          id: "9.1",
          title: "Analítica",
          body: [
            "Menú → Estadísticas. KPIs por año, cobertura por zona, top de jueces y exportación CSV.",
          ],
        },
        {
          id: "9.2",
          title: "Normativa IPF",
          body: ["Consulta el reglamento técnico IPF integrado en la sección Normativa."],
        },
      ],
    },
    {
      title: "ROLES Y PERMISOS",
      steps: [
        {
          id: "10.1",
          title: "Resumen de roles",
          body: [
            "· super_admin — control total, usuarios, aprobaciones.",
            "· delegado_jueces (Comité) — autoridad nacional sobre jueces, exámenes, informes y ascensos.",
            "· delegado_zona — campeonatos, tarimas y jueces de su zona.",
            "· responsable_financiero_jueces — compensación y recibos PDF (lectura de tarimas/censo).",
            "· solo_ver — solo lectura.",
            "La UI oculta acciones fuera de tu alcance; el servidor revalida cada operación.",
          ],
        },
        {
          id: "10.2",
          title: "Gestión de usuarios",
          body: [
            "Menú Usuarios (solo AEP Nacional): activar/desactivar, editar rol/zona, resetear contraseña y eliminar.",
          ],
        },
      ],
    },
    {
      title: "APP MÓVIL (iOS)",
      steps: [
        {
          id: "11.1",
          title: "Funciones móviles",
          body: [
            "La app iOS comparte los mismos datos en tiempo real con la web.",
            "Incluye Face ID/Touch ID, notificaciones de asignaciones y aprobaciones, modo offline y escaneo de cuadrantes PDF con la cámara.",
          ],
        },
      ],
    },
    {
      title: "NAVEGACIÓN Y BARRA LATERAL",
      steps: [
        {
          id: "12.1",
          title: "Menú lateral",
          body: [
            "Operaciones: Dashboard, Campeonatos, Compensación (rol financiero), Directorio.",
            "Gestión: Estadísticas, Normativa, Documentación (guía web + manual PDF).",
            "El perfil de usuario está en la esquina superior (topbar), no en el pie del menú.",
            "El botón «Colapsar» reduce la barra a iconos; la preferencia se guarda en el navegador.",
          ],
        },
      ],
    },
    {
      title: "AYUDA Y CONTACTO",
      steps: [
        {
          id: "13.1",
          title: "Documentación en la app",
          body: [
            `Consulta la documentación integrada en ${appUrl}/docs (guía, privacidad y condiciones).`,
          ],
        },
        {
          id: "13.2",
          title: "Incidencias",
          body: [
            `Ante cualquier duda o problema, escribe a ${TARIMA_GUIDE_META.contactEmail}.`,
            "Indica captura de pantalla, campeonato afectado y pasos para reproducir el error.",
          ],
        },
      ],
    },
  ];
}
