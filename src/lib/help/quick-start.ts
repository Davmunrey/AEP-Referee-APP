import type { UserRole } from "@/lib/types";

/**
 * Tour / guía rápida de primeros pasos, adaptada al rol del usuario. Es una
 * lista de pasos con enlaces directos a cada pantalla; es la base del widget
 * de Ayuda, junto con el buscador local de temas (base de conocimiento).
 */

export interface QuickStartStep {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}

const SUPER_ADMIN: QuickStartStep[] = [
  {
    title: "Revisa el panel de inicio",
    body: "KPIs de cobertura, salud operativa (0–100), avisos priorizados y próximos campeonatos. El panel se actualiza en vivo.",
    href: "/",
    linkLabel: "Abrir panel",
  },
  {
    title: "Gestiona usuarios y permisos",
    body: "Crea cuentas, asigna roles (incluido responsable financiero) y zonas. Resetea contraseñas desde el icono llave.",
    href: "/admin/users",
    linkLabel: "Usuarios",
  },
  {
    title: "Campeonatos y tarimas",
    body: "Alta manual o importación del calendario AEP. Monta plantilla (horario PDF), asigna jueces en rejilla de 3 columnas y envía a aprobación.",
    href: "/competitions",
    linkLabel: "Campeonatos",
  },
  {
    title: "Aprueba tarimas y ascensos",
    body: "Revisa propuestas pendientes a nivel nacional y aprueba o rechaza con comentario.",
    href: "/approvals",
    linkLabel: "Aprobaciones",
  },
  {
    title: "Compensación y normativa",
    body: "Panel central de compensación (km, recibos PDF) y sección Normativa con guía AEP, plazas, baremo y reglamento IPF.",
    href: "/compensation",
    linkLabel: "Compensación",
  },
];

const DELEGADO_JUECES: QuickStartStep[] = [
  {
    title: "Empieza por el panel",
    body: "Cobertura nacional, salud operativa y avisos te marcan las prioridades del día.",
    href: "/",
    linkLabel: "Abrir panel",
  },
  {
    title: "Revisa aprobaciones pendientes",
    body: "Apruebas o rechazas tarimas y ascensos con alcance nacional.",
    href: "/approvals",
    linkLabel: "Aprobaciones",
  },
  {
    title: "Gestiona el censo de jueces",
    body: "Directorio, importación Excel maestro, fichas con domicilio OSM, exámenes, informes y sanciones.",
    href: "/referees",
    linkLabel: "Directorio",
  },
  {
    title: "Consulta estadísticas y normativa",
    body: "KPIs anuales, exportación CSV y normativa (Guía AEP, plazas, compensación, IPF).",
    href: "/analytics",
    linkLabel: "Estadísticas",
  },
  {
    title: "Usuarios de la plataforma",
    body: "Altas de cuenta, roles, zonas y reseteo de contraseñas.",
    href: "/admin/users",
    linkLabel: "Usuarios",
  },
];

const DELEGADO_ZONA: QuickStartStep[] = [
  {
    title: "Abre tus campeonatos",
    body: "Lista con tarimas abiertas priorizadas, filtros por tipo/zona y acceso rápido a «Montar tarima».",
    href: "/competitions",
    linkLabel: "Campeonatos",
  },
  {
    title: "Construye la tarima",
    body: "Importa horario PDF o crea plantilla manual. Asigna jueces (arrastrar o tocar plaza). Revisa avisos de conflicto y cobertura.",
  },
  {
    title: "Envía a aprobación",
    body: "Cuando todas las plazas requeridas estén cubiertas, envía la propuesta al Comité de Jueces.",
    href: "/approvals",
    linkLabel: "Ver aprobaciones",
  },
  {
    title: "Imprevistos en tarimas aprobadas",
    body: "Si la tarima ya está aprobada, usa «Registrar imprevisto» en la cabecera antes de cambiar asignaciones.",
  },
  {
    title: "Mantén tu censo y ascensos",
    body: "Edita fichas de tu zona, registra exámenes/informes/sanciones y solicita ascensos de nivel.",
    href: "/referees",
    linkLabel: "Directorio",
  },
  {
    title: "Exporta el cuadrante",
    body: "Menú Exportar en la tarima: PDF oficial AEP, Excel o WhatsApp.",
  },
];

const SOLO_VER: QuickStartStep[] = [
  {
    title: "Consulta el panel",
    body: "Acceso de solo lectura a KPIs, salud operativa y avisos de la temporada.",
    href: "/",
    linkLabel: "Abrir panel",
  },
  {
    title: "Explora campeonatos y tarimas",
    body: "Revisa cuadrantes, cobertura y detalle de cada campeonato sin poder editarlos.",
    href: "/competitions",
    linkLabel: "Campeonatos",
  },
  {
    title: "Consulta el directorio de jueces",
    body: "Fichas, historial arbitral, exámenes y sanciones en modo lectura.",
    href: "/referees",
    linkLabel: "Directorio",
  },
  {
    title: "Estadísticas y normativa",
    body: "KPIs anuales exportables y normativa AEP (guía 2026, plazas en tarima, compensación de jueces, reglamento IPF).",
    href: "/regulations",
    linkLabel: "Normativa",
  },
];

const FINANCIERO: QuickStartStep[] = [
  {
    title: "Abre el panel de compensación",
    body: "Menú lateral → Compensación. Ves todos los campeonatos con jueces en tarima, km pendientes y totales.",
    href: "/compensation",
    linkLabel: "Compensación",
  },
  {
    title: "Configura clubes organizadores",
    body: "En cada campeonato: uno o varios clubes del listado curado AEP y e-mails del recibo. Los km se introducen manualmente por juez.",
  },
  {
    title: "Km, Comparte y Montaje sistema",
    body: "Km ida+vuelta enteros por juez. Comparte exime solo kilometraje al pasajero. Mont. es montaje informático (importe manual), distinto del puesto ordenador en tarima.",
  },
  {
    title: "Revisa desglose y exporta recibos",
    body: "Expande cada fila para ver posiciones por sesión (S1 Central, Pesaje…). Exportar recibo pide IBAN solo en el modal (no se guarda) y genera PDF AEP o club.",
    href: "/regulations",
    linkLabel: "Baremo en Normativa",
  },
  {
    title: "Documentación de apoyo",
    body: "Guía completa en Documentación y pestaña Compensación dentro de Normativa.",
    href: "/docs",
    linkLabel: "Documentación",
  },
];

const QUICK_START: Record<UserRole, QuickStartStep[]> = {
  super_admin: SUPER_ADMIN,
  delegado_jueces: DELEGADO_JUECES,
  delegado_zona: DELEGADO_ZONA,
  responsable_financiero_jueces: FINANCIERO,
  solo_ver: SOLO_VER,
};

/** Pasos de inicio para un rol (con respaldo a «solo lectura» si no se reconoce). */
export function quickStartForRole(role: UserRole): QuickStartStep[] {
  return QUICK_START[role] ?? SOLO_VER;
}
