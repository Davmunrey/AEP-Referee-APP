import type { UserRole } from "@/lib/types";

/**
 * Tour / guía rápida de primeros pasos, adaptada al rol del usuario. Es una
 * lista de pasos con enlaces directos a cada pantalla; no usa IA. Acompaña al
 * asistente local en el widget de Ayuda.
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
    body: "Cobertura global, salud operativa, avisos y próximos campeonatos de un vistazo.",
    href: "/",
    linkLabel: "Abrir panel",
  },
  {
    title: "Gestiona usuarios y permisos",
    body: "Da de alta cuentas y asigna roles y zonas desde la administración de usuarios.",
  },
  {
    title: "Crea un campeonato",
    body: "Tipo, sede, fechas, sesiones y plazas requeridas.",
    href: "/competitions/new",
    linkLabel: "Nuevo campeonato",
  },
  {
    title: "Aprueba tarimas y ascensos",
    body: "Revisa las propuestas pendientes a nivel nacional.",
    href: "/approvals",
    linkLabel: "Aprobaciones",
  },
];

const DELEGADO_JUECES: QuickStartStep[] = [
  {
    title: "Empieza por el panel",
    body: "Cobertura, salud operativa y avisos te marcan las prioridades del día.",
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
    body: "Altas, niveles, exámenes, informes y sanciones.",
    href: "/referees",
    linkLabel: "Jueces",
  },
  {
    title: "Consulta la analítica",
    body: "Estadísticas por zona, top de jueces y tasa de rechazo.",
    href: "/analytics",
    linkLabel: "Analítica",
  },
];

const DELEGADO_ZONA: QuickStartStep[] = [
  {
    title: "Abre tus campeonatos",
    body: "Gestionas las competiciones y jueces de tu zona.",
    href: "/competitions",
    linkLabel: "Campeonatos",
  },
  {
    title: "Construye la tarima",
    body: "Toca cada plaza y asigna un juez; controla la cobertura.",
  },
  {
    title: "Envía a aprobación",
    body: "Cuando la tarima esté completa, mándala al Comité de Jueces.",
  },
  {
    title: "Mantén tu censo",
    body: "Edita fichas y registra exámenes, informes y sanciones de tu zona.",
    href: "/referees",
    linkLabel: "Jueces",
  },
  {
    title: "Solicita ascensos",
    body: "Propón el ascenso de nivel de tus jueces para revisión del Comité.",
    href: "/promotions",
    linkLabel: "Ascensos",
  },
];

const SOLO_VER: QuickStartStep[] = [
  {
    title: "Consulta el panel",
    body: "Tienes acceso de solo lectura a la información de la plataforma.",
    href: "/",
    linkLabel: "Abrir panel",
  },
  {
    title: "Explora campeonatos y jueces",
    body: "Revisa tarimas, fichas de jueces y su historial.",
    href: "/competitions",
    linkLabel: "Campeonatos",
  },
  {
    title: "Revisa la analítica y la normativa",
    body: "Estadísticas de la actividad arbitral y reglas IPF aplicables.",
    href: "/analytics",
    linkLabel: "Analítica",
  },
];

const FINANCIERO: QuickStartStep[] = [
  {
    title: "Revisa campeonatos y tarimas",
    body: "Consulta las asignaciones de jueces para calcular la compensación por competición.",
    href: "/competitions",
    linkLabel: "Campeonatos",
  },
  {
    title: "Calcula compensaciones",
    body: "Desde cada campeonato, abre la sección de compensación, revisa importes y genera el recibo PDF.",
  },
  {
    title: "Exporta recibos",
    body: "Al exportar, introduce el IBAN del juez en ese momento. La app no guarda números de cuenta.",
  },
  {
    title: "Configura el organizador",
    body: "Indica si el campeonato es de club o de AEP y el e-mail de devolución del recibo.",
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
