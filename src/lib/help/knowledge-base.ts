import type { UserRole } from "@/lib/types";

/**
 * Base de conocimiento del asistente de ayuda. Es un asistente LOCAL: no usa
 * ninguna IA externa ni envía datos a terceros. Empareja la pregunta del
 * usuario con estas entradas (mismas guías que la documentación) y responde con
 * la sección relevante y enlaces de acción. No «inventa»: solo devuelve texto
 * curado, así que es gratis, privado (RGPD) y predecible.
 */

export interface HelpLink {
  label: string;
  href: string;
}

export interface HelpEntry {
  id: string;
  /** Pregunta canónica, mostrada como título de la respuesta. */
  question: string;
  /** Términos y sinónimos para el emparejamiento (además de pregunta y respuesta). */
  keywords: string[];
  /** Respuesta breve en texto plano. */
  answer: string;
  /** Enlaces de acción relacionados. */
  links?: HelpLink[];
  /** Roles a los que aplica especialmente; si se omite, aplica a todos. */
  roles?: UserRole[];
}

/** Normaliza texto: minúsculas, sin acentos, sin signos, espacios colapsados. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas combinantes (acentos)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set(
  normalizeText(
    "el la los las lo un una unos unas de del a al y e o u que como cual cuales cuando donde porque " +
      "por para con sin se mi tu su sus es son esta estan hay cuanto cuanta cuantos cuantas mas menos muy " +
      "yo me te le les nos en si no ya solo puedo puede pueden quiero hacer tengo debo necesito",
  ).split(" "),
);

/** Tokens significativos de un texto (sin stopwords, ≥3 caracteres). */
export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export const KNOWLEDGE_BASE: HelpEntry[] = [
  {
    id: "login",
    question: "¿Cómo inicio sesión?",
    keywords: ["acceso", "entrar", "login", "correo", "email", "contrasena", "iniciar sesion"],
    answer:
      "Accede con tu correo y contraseña autorizados por el Comité de Jueces. En la app iOS puedes activar Face ID para entrar más rápido.",
    links: [{ label: "Documentación", href: "/docs" }],
  },
  {
    id: "password-reset",
    question: "¿Cómo recupero mi contraseña?",
    keywords: ["contrasena", "clave", "olvide", "olvidada", "recuperar", "restablecer", "reset", "password"],
    answer:
      "En la pantalla de acceso pulsa «¿Olvidaste tu contraseña?» e introduce tu correo; recibirás un enlace para restablecerla. Una vez dentro, puedes cambiarla desde el menú de usuario en la esquina superior («Cambiar contraseña»).",
    links: [{ label: "Ir al acceso", href: "/sign-in" }],
  },
  {
    id: "dashboard",
    question: "¿Qué muestra el panel de inicio?",
    keywords: ["panel", "inicio", "dashboard", "kpi", "cobertura", "resumen", "avisos", "salud"],
    answer:
      "El panel de inicio resume la cobertura global, la salud operativa, los avisos y los próximos campeonatos. Es tu punto de partida diario.",
    links: [{ label: "Abrir panel", href: "/" }],
  },
  {
    id: "create-competition",
    question: "¿Cómo creo un campeonato?",
    keywords: ["campeonato", "competicion", "crear", "nuevo", "alta", "evento", "sede", "sesiones", "plazas"],
    answer:
      "En «Campeonatos» pulsa «Nuevo» e indica tipo (AEP-1/2/3), sede, fechas, sesiones y plazas requeridas. Después podrás abrir su detalle para construir la tarima.",
    links: [
      { label: "Campeonatos", href: "/competitions" },
      { label: "Nuevo campeonato", href: "/competitions/new" },
    ],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "build-roster",
    question: "¿Cómo construyo la tarima (cuadrante)?",
    keywords: ["tarima", "cuadrante", "construir", "armar", "montar", "asignar", "plaza", "jueces", "cobertura"],
    answer:
      "Abre el detalle del campeonato y entra en la Tarima. Toca una plaza y elige al juez que la cubre; el indicador de cobertura muestra cuántas plazas llevas asignadas. Cuando esté completa, envíala a aprobación.",
    links: [{ label: "Campeonatos", href: "/competitions" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "assign-judge",
    question: "¿Cómo asigno un juez a una plaza?",
    keywords: ["asignar", "asignacion", "juez", "plaza", "puesto", "tarima", "central", "lateral", "jurado"],
    answer:
      "En la Tarima, toca la plaza vacía y selecciona un juez de la lista (filtrada por elegibilidad y zona). Para quitarlo, vuelve a tocar la plaza. Cada plaza exige un nivel mínimo según el tipo de competición.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "submit-approval",
    question: "¿Cómo envío la tarima a aprobación?",
    keywords: ["enviar", "aprobacion", "propuesta", "tarima", "comite", "remitir", "mandar"],
    answer:
      "Cuando la tarima esté completa, pulsa «Enviar a aprobación» en la cabecera. El Comité de Jueces la revisará y recibirás una notificación cuando se apruebe o se rechace.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "approvals",
    question: "¿Cómo apruebo o rechazo una tarima?",
    keywords: ["aprobar", "rechazar", "aprobacion", "aprobaciones", "revisar", "comite", "propuesta", "pendiente"],
    answer:
      "En «Aprobaciones» verás las propuestas pendientes. Ábrelas para revisarlas y aprobarlas o rechazarlas con un comentario. Aprueban el Super Admin y el Comité de Jueces (alcance nacional).",
    links: [{ label: "Aprobaciones", href: "/approvals" }],
    roles: ["super_admin", "delegado_jueces"],
  },
  {
    id: "manage-judges",
    question: "¿Cómo doy de alta o edito un juez?",
    keywords: ["juez", "jueces", "censo", "ficha", "alta", "editar", "directorio", "nivel", "zona"],
    answer:
      "En «Jueces» puedes dar de alta o editar fichas (nivel, zona, contacto) y consultar el historial. El delegado de zona trabaja sobre los jueces de su propia zona.",
    links: [{ label: "Jueces", href: "/referees" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "sanctions",
    question: "¿Cómo registro una sanción a un juez?",
    keywords: ["sancion", "sancionar", "sanciones", "amonestacion", "motivo", "duracion", "castigo"],
    answer:
      "Desde la ficha del juez, en la sección «Sanciones», indica el motivo, la fecha de inicio y la duración. El delegado de zona puede sancionar a los jueces de su zona.",
    links: [{ label: "Jueces", href: "/referees" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "exams",
    question: "¿Cómo registro un examen arbitral?",
    keywords: ["examen", "examenes", "prueba", "evaluacion", "puntuacion", "nivel", "aprobado"],
    answer:
      "En «Exámenes» (o desde la ficha del juez) registra el examen indicando tipo, nivel objetivo, fecha, examinador y resultado. Sirve de base para los ascensos de nivel.",
    links: [{ label: "Exámenes", href: "/exams" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "reports",
    question: "¿Cómo creo un informe?",
    keywords: ["informe", "informes", "reporte", "redactar", "competicion", "juez", "incidencia"],
    answer:
      "En «Informes» crea un informe sobre una competición o un juez: título, tipo, evento y contenido. Quedan archivados y consultables desde la ficha correspondiente.",
    links: [{ label: "Informes", href: "/reports" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "promotions",
    question: "¿Cómo solicito o reviso un ascenso de nivel?",
    keywords: ["ascenso", "ascensos", "promocion", "subir", "nivel", "solicitar", "regional", "nacional", "ipf"],
    answer:
      "En «Ascensos», el delegado de zona solicita el ascenso de un juez al siguiente nivel; el Comité de Jueces lo revisa y lo aprueba o rechaza. Los niveles son Regional, Nacional, IPF Cat. 2 e IPF Cat. 1.",
    links: [{ label: "Ascensos", href: "/promotions" }],
  },
  {
    id: "analytics",
    question: "¿Dónde veo la analítica y estadísticas?",
    keywords: ["analitica", "estadisticas", "datos", "metricas", "zona", "ranking", "rechazo", "exportar", "csv"],
    answer:
      "En «Analítica» encuentras estadísticas por zona, el top de jueces y la tasa de rechazo por año, con opción de exportar a CSV.",
    links: [{ label: "Analítica", href: "/analytics" }],
  },
  {
    id: "regulations",
    question: "¿Dónde consulto la normativa?",
    keywords: ["normativa", "reglas", "reglamento", "ipf", "requisitos", "nivel minimo", "guia"],
    answer:
      "En «Normativa» tienes las reglas IPF aplicables: niveles mínimos por plaza, requisitos por tipo de competición y demás criterios usados al validar la tarima.",
    links: [{ label: "Normativa", href: "/regulations" }],
  },
  {
    id: "roles-zones",
    question: "¿Por qué no puedo editar datos de otra zona?",
    keywords: ["zona", "permiso", "permisos", "rol", "roles", "delegado", "editar", "alcance", "restriccion", "acceso"],
    answer:
      "Los delegados de zona solo gestionan los campeonatos y jueces de su propia zona. El Comité de Jueces y el Super Admin tienen alcance nacional. «Solo lectura» consulta sin modificar. Los permisos se revalidan en el servidor en cada operación.",
    links: [{ label: "Roles y permisos", href: "/docs#roles" }],
  },
  {
    id: "ios-app",
    question: "¿Cómo funciona la app de iOS?",
    keywords: ["app", "movil", "ios", "iphone", "ipad", "nativa", "face id", "biometria", "instalar"],
    answer:
      "La app nativa de iOS usa los mismos datos que la web en tiempo real, y añade Face ID, notificaciones push, modo offline y escaneo de cuadrantes con la cámara. Se distribuye por TestFlight a las cuentas autorizadas.",
    links: [{ label: "App móvil", href: "/docs#movil" }],
  },
  {
    id: "notifications",
    question: "¿Recibiré notificaciones?",
    keywords: ["notificacion", "notificaciones", "aviso", "avisos", "push", "alerta", "asignacion", "aprobacion"],
    answer:
      "Sí. En la app iOS recibes avisos cuando se te asigna a una tarima y cuando se resuelve una propuesta de aprobación. Los cambios se reflejan en tiempo real entre web y móvil.",
  },
  {
    id: "offline",
    question: "¿Puedo usar la app sin conexión?",
    keywords: ["offline", "sin conexion", "internet", "cache", "avion", "desconectado"],
    answer:
      "La app iOS guarda en caché los datos recientes (jueces, campeonatos, normativa) para consultarlos sin conexión, con un aviso de «datos en caché». Las ediciones de tarima y aprobaciones requieren conexión.",
  },
  {
    id: "data-mobile-web",
    question: "¿Los datos del móvil y la web son los mismos?",
    keywords: ["datos", "movil", "web", "sincronizado", "tiempo real", "mismo", "iguales"],
    answer:
      "Sí. Ambas aplicaciones usan el mismo backend, así que cualquier cambio se refleja en tiempo real en las dos.",
  },
  {
    id: "privacy",
    question: "¿Cómo se tratan mis datos? (privacidad)",
    keywords: ["privacidad", "datos", "rgpd", "proteccion", "derechos", "tratamiento", "personales"],
    answer:
      "La AEP es responsable del tratamiento. Se tratan datos identificativos y federativos de los jueces para organizar el arbitraje. Tienes derecho de acceso, rectificación, supresión, oposición, limitación y portabilidad.",
    links: [
      { label: "Privacidad y datos", href: "/docs#privacidad" },
      { label: "Contacto", href: "/docs#contacto" },
    ],
  },
  {
    id: "contact",
    question: "¿Con quién contacto si tengo dudas?",
    keywords: ["contacto", "ayuda", "soporte", "comite", "duda", "consulta", "escribir"],
    answer:
      "Para consultas sobre la plataforma o tus datos, contacta con el Comité de Jueces de la AEP a través de los canales oficiales de la federación.",
    links: [{ label: "Contacto", href: "/docs#contacto" }],
  },
];

export interface HelpResult {
  entry: HelpEntry;
  score: number;
}

/**
 * Busca en la base de conocimiento las entradas más relevantes para `query`.
 * Puntúa por solape de tokens (con bonus por coincidencia exacta de keyword y
 * por relevancia de rol). Todo local y síncrono; no hay llamadas de red.
 */
export function searchKnowledgeBase(
  query: string,
  role?: UserRole,
  limit = 4,
): HelpResult[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const results: HelpResult[] = [];
  for (const entry of KNOWLEDGE_BASE) {
    const haystack = tokenize(`${entry.question} ${entry.keywords.join(" ")} ${entry.answer}`);
    const haystackSet = new Set(haystack);
    const keywordSet = new Set(entry.keywords.flatMap((k) => tokenize(k)));

    let overlap = 0;
    for (const t of qTokens) {
      if (haystackSet.has(t)) {
        overlap += 1;
      } else if (haystack.some((h) => h.startsWith(t) || t.startsWith(h))) {
        overlap += 0.5;
      }
    }
    if (overlap === 0) continue;

    let score = overlap / qTokens.length;
    for (const t of qTokens) {
      if (keywordSet.has(t)) score += 0.5; // las keywords están curadas
    }
    if (role && entry.roles && entry.roles.includes(role)) score += 0.3;

    results.push({ entry, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
