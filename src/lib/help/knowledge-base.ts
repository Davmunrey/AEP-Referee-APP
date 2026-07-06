import type { UserRole } from "@/lib/types";
import { AEP_TARIMA_OFFICIAL_URL } from "@/lib/aep-branding";

/**
 * Base de conocimiento del asistente de ayuda. El widget combina búsqueda local
 * (esta lista) con un modelo de IA cuando está configurado; en ambos casos la
 * respuesta se ancla a estas guías curadas para no inventar funciones.
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
    .replace(/[\u0300-\u036f]/g, "")
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
    id: "what-is",
    question: "¿Qué es AEP Tarima?",
    keywords: ["aep", "tarima", "plataforma", "app", "aplicacion", "powerlifting", "jueces", "que es"],
    answer:
      `AEP Tarima es la plataforma web oficial de la AEP para gestionar jueces: censo arbitral, tarimas (cuadrantes), aprobaciones, exámenes, ascensos, sanciones, informes, estadísticas, normativa y compensación económica. Solo versión web en ${AEP_TARIMA_OFFICIAL_URL}. El acceso requiere cuenta autorizada por el Comité de Jueces.`,
    links: [
      { label: "Documentación", href: "/docs" },
      { label: "Panel de inicio", href: "/" },
    ],
  },
  {
    id: "login",
    question: "¿Cómo inicio sesión?",
    keywords: ["acceso", "entrar", "login", "correo", "email", "contrasena", "iniciar sesion", "cuenta"],
    answer:
      "Abre la pantalla de acceso e introduce tu correo y contraseña autorizados por el Comité de Jueces. No hay registro público: las cuentas las crea AEP Nacional.",
    links: [{ label: "Ir al acceso", href: "/sign-in" }],
  },
  {
    id: "password-reset",
    question: "¿Cómo recupero mi contraseña?",
    keywords: ["contrasena", "clave", "olvide", "olvidada", "recuperar", "restablecer", "reset", "password", "cambiar"],
    answer:
      "En la pantalla de acceso pulsa «¿Olvidaste tu contraseña?» e introduce tu correo; recibirás un enlace para restablecerla. Una vez dentro, también puedes cambiarla desde el menú de usuario (esquina superior derecha) → «Cambiar contraseña» (pide la actual y la nueva, mínimo 8 caracteres).",
    links: [{ label: "Ir al acceso", href: "/sign-in" }],
  },
  {
    id: "change-password",
    question: "¿Cómo cambio mi contraseña estando dentro?",
    keywords: ["cambiar contrasena", "nueva clave", "actualizar password", "topbar", "menu usuario"],
    answer:
      "Pulsa tu nombre en la esquina superior derecha y elige «Cambiar contraseña». Debes indicar la contraseña actual y la nueva (mínimo 8 caracteres). Los administradores también pueden resetear la de otro usuario desde Usuarios (icono llave).",
    links: [{ label: "Usuarios (admin)", href: "/admin/users" }],
    roles: ["super_admin", "delegado_jueces"],
  },
  {
    id: "dashboard",
    question: "¿Qué muestra el panel de inicio?",
    keywords: ["panel", "inicio", "dashboard", "kpi", "cobertura", "resumen", "avisos", "salud", "recomendaciones"],
    answer:
      "El Dashboard resume KPIs (jueces activos, próximos campeonatos, plazas sin cubrir, aprobaciones pendientes, cobertura nacional), un índice de salud operativa (0–100), recomendaciones priorizadas y próximos eventos. Se actualiza en vivo; puedes pausar el refresco. Atajos: Jueces, Aprobaciones, Exportar y Nuevo campeonato.",
    links: [{ label: "Abrir panel", href: "/" }],
  },
  {
    id: "navigation",
    question: "¿Cómo me muevo por la aplicación?",
    keywords: ["menu", "barra lateral", "sidebar", "navegacion", "secciones", "donde esta"],
    answer:
      "La barra lateral agrupa Operaciones (Dashboard, Campeonatos, Compensación si aplica, Tarima activa, Directorio) y Gestión (Aprobaciones, Ascensos, Exámenes, Informes, Estadísticas, Normativa, Documentación, Usuarios si eres admin). Puedes colapsar el menú; la preferencia se guarda en el navegador. Tu usuario y contraseña están en la esquina superior derecha.",
    links: [{ label: "Documentación", href: "/docs" }],
  },
  {
    id: "create-competition",
    question: "¿Cómo creo un campeonato?",
    keywords: ["campeonato", "competicion", "crear", "nuevo", "alta", "evento", "sede", "sesiones", "plazas", "aep1", "aep2", "aep3"],
    answer:
      "En «Campeonatos» pulsa «+ Nuevo» e indica tipo (AEP-1/2/3), sede, fechas, sesiones y plazas requeridas. También puedes importar el calendario anual AEP (PDF/CSV): sube el archivo, revisa la vista previa y selecciona qué campeonatos crear.",
    links: [
      { label: "Campeonatos", href: "/competitions" },
      { label: "Nuevo campeonato", href: "/competitions/new" },
    ],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "import-calendar",
    question: "¿Cómo importo el calendario AEP?",
    keywords: ["importar", "calendario", "pdf", "csv", "temporada", "campeonatos masivos"],
    answer:
      "En la lista de Campeonatos usa «Importar calendario AEP». Sube el PDF o CSV del calendario oficial, revisa la vista previa con los eventos detectados y marca cuáles quieres dar de alta en la plataforma.",
    links: [{ label: "Campeonatos", href: "/competitions" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "build-roster",
    question: "¿Cómo construyo la tarima (cuadrante)?",
    keywords: ["tarima", "cuadrante", "construir", "armar", "montar", "plantilla", "asignacion", "cobertura"],
    answer:
      "Abre el campeonato y entra en la Tarima. El flujo tiene tres fases: Plantilla (importar horario PDF o crear sesiones manualmente), Asignación (arrastra o toca plaza+juez) y Revisión. El indicador de cobertura muestra plazas confirmadas sobre requeridas. Cuando esté completa, guarda borrador o envía a aprobación.",
    links: [{ label: "Campeonatos", href: "/competitions" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "import-schedule",
    question: "¿Cómo importo el horario oficial en la tarima?",
    keywords: ["horario", "importar horario", "plantilla", "sesiones", "pdf horario", "categorias"],
    answer:
      "En la Tarima, menú «Plantilla ▾» → «Importar horario (PDF)». Sube el horario oficial AEP; la app detecta sesiones, categorías y horarios. Revisa la vista previa y guarda la plantilla antes de asignar jueces.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "import-roster-pdf",
    question: "¿Cómo importo un cuadrante PDF con jueces ya asignados?",
    keywords: ["importar cuadrante", "cuadrante pdf", "detectar jueces", "ocr", "escaneado"],
    answer:
      "Con la plantilla creada, usa «Plantilla ▾» → «Importar cuadrante (PDF)». Cruza los nombres del cuadrante oficial con el directorio y propone asignaciones. Funciona con los formatos AEP de texto seleccionable; si es un escaneado (imagen) avisará y tendrás que asignar a mano.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "assign-judge",
    question: "¿Cómo asigno un juez a una plaza?",
    keywords: ["asignar", "asignacion", "juez", "plaza", "puesto", "central", "lateral", "jurado", "arrastrar", "drag"],
    answer:
      "En la pestaña Asignación hay dos paneles: jueces disponibles (izquierda) y sesiones con plazas (derecha). Asigna arrastrando, tocando plaza y luego juez, o importando cuadrante PDF. Filtra por zona, nivel y búsqueda. Cada plaza exige nivel mínimo según tipo de competición y rol. Para quitar un juez, vuelve a tocar la plaza.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "roster-layout",
    question: "¿Cómo se organizan las plazas en la tarima?",
    keywords: ["columnas", "3 columnas", "rejilla", "pesaje", "ordenador", "liftingcast", "roles", "layout"],
    answer:
      "Las plazas de sesión se muestran en una rejilla de hasta 3 columnas (central, lateral, ordenador, jurado, etc.). Pesaje usa el mismo esquema de 3 columnas (pesaje, equipamiento, material). El número real de plazas lo marca la plantilla importada o creada manualmente.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "roster-conflicts",
    question: "¿Qué significan los avisos de conflicto en la tarima?",
    keywords: ["conflicto", "solape", "cruce", "zona", "nivel", "hueco", "advertencia", "forzable"],
    answer:
      "La tarima avisa de huecos, solapes horarios, cruces de zona o nivel insuficiente. Algunos conflictos son bloqueantes (normativa o nivel); otros son forzables (p. ej. solape tarima/pesaje) y piden confirmación al asignar. Revisa el panel de jueces: los no asignables aparecen bloqueados.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "roster-imprevisto",
    question: "¿Cómo cambio una tarima ya aprobada por un imprevisto?",
    keywords: ["imprevisto", "aprobada", "bloqueada", "sustitucion", "baja", "ultima hora", "desbloquear"],
    answer:
      "Si la tarima está aprobada queda bloqueada. Pulsa «Registrar imprevisto» en el aviso amarillo de la cabecera, modifica las asignaciones necesarias y vuelve a «Enviar a aprobación» para que el Comité valide los cambios.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "submit-approval",
    question: "¿Cómo envío la tarima a aprobación?",
    keywords: ["enviar", "aprobacion", "propuesta", "tarima", "comite", "remitir", "mandar", "borrador"],
    answer:
      "Cuando la tarima esté completa (sin plazas obligatorias vacías), pulsa «Enviar a aprobación» en la cabecera. Antes puedes guardar como borrador. El Comité revisará la propuesta en la sección Aprobaciones.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "export-roster",
    question: "¿Cómo exporto el cuadrante?",
    keywords: ["exportar", "pdf", "excel", "xlsx", "whatsapp", "cuadrante", "imprimir", "acta"],
    answer:
      "En la Tarima, menú «Exportar ▾»: Cuadrante PDF (formato oficial AEP, abre impresión), Cuadrante Excel (.xlsx por día), Acta en texto o Compartir por WhatsApp. También hay icono PDF directo en la lista de campeonatos.",
    links: [{ label: "Campeonatos", href: "/competitions" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "active-roster",
    question: "¿Qué es «Tarima activa» en el menú?",
    keywords: ["tarima activa", "acceso rapido", "campeonato abierto", "montar"],
    answer:
      "«Tarima activa» es un acceso directo al campeonato en curso con más cobertura pendiente, para seguir montando la plantilla sin buscarlo en la lista.",
    roles: ["super_admin", "delegado_jueces", "delegado_zona", "solo_ver"],
  },
  {
    id: "approvals",
    question: "¿Cómo apruebo o rechazo una tarima?",
    keywords: ["aprobar", "rechazar", "aprobacion", "aprobaciones", "revisar", "comite", "propuesta", "pendiente"],
    answer:
      "En «Aprobaciones» verás propuestas de tarima y ascensos pendientes. Ábrelas para revisar el detalle y aprobar o rechazar con comentario. Aprueban el Super Admin y el Comité de Jueces (alcance nacional).",
    links: [{ label: "Aprobaciones", href: "/approvals" }],
    roles: ["super_admin", "delegado_jueces"],
  },
  {
    id: "manage-judges",
    question: "¿Cómo doy de alta o edito un juez?",
    keywords: ["juez", "jueces", "censo", "ficha", "alta", "editar", "directorio", "nivel", "zona", "domicilio"],
    answer:
      "En «Directorio» puedes buscar, filtrar por zona/nivel/estado, dar de alta (+ Nuevo juez) o editar fichas (nivel, zona, contacto, domicilio con autocompletado OpenStreetMap). El delegado de zona trabaja sobre los jueces de su zona. La ficha incluye historial arbitral, sanciones, exámenes, informes y ascensos.",
    links: [{ label: "Directorio", href: "/referees" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "import-judges-excel",
    question: "¿Cómo importo el Excel maestro de jueces?",
    keywords: ["excel", "importar jueces", "maestro", "registro", "masivo", "hoja datos"],
    answer:
      "En Directorio usa «Importar Excel maestro» para alta o actualización masiva del censo (solo AEP Nacional). Revisa la vista previa antes de aplicar. Archivos muy grandes (>8 MB) pueden fallar: divide el Excel o elimina hojas innecesarias.",
    links: [{ label: "Directorio", href: "/referees" }],
    roles: ["super_admin", "delegado_jueces"],
  },
  {
    id: "sanctions",
    question: "¿Cómo registro una sanción a un juez?",
    keywords: ["sancion", "sancionar", "sanciones", "amonestacion", "motivo", "duracion", "castigo"],
    answer:
      "Desde la ficha del juez, en la sección «Sanciones», indica motivo, fecha de inicio y duración. El delegado de zona puede sancionar a los jueces de su zona; el Comité tiene alcance nacional.",
    links: [{ label: "Directorio", href: "/referees" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "exams",
    question: "¿Cómo registro un examen arbitral?",
    keywords: ["examen", "examenes", "prueba", "evaluacion", "puntuacion", "nivel", "aprobado", "recertificacion", "ipf"],
    answer:
      "En «Exámenes» (o desde la ficha del juez) registra el examen: tipo (nuevo juez, ascenso IPF, recertificación), nivel objetivo, fecha, examinador y resultado. Sirve de base para los ascensos de nivel.",
    links: [{ label: "Exámenes", href: "/exams" }],
    roles: ["super_admin", "delegado_jueces", "delegado_zona"],
  },
  {
    id: "reports",
    question: "¿Cómo creo un informe?",
    keywords: ["informe", "informes", "reporte", "redactar", "competicion", "juez", "incidencia"],
    answer:
      "En «Informes» crea un informe sobre una competición o un juez: título, tipo, evento y contenido. Quedan archivados y consultables desde la ficha correspondiente. El delegado de zona ve solo los de su zona; nacional ve todo.",
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
    question: "¿Dónde veo las estadísticas?",
    keywords: ["analitica", "estadisticas", "datos", "metricas", "zona", "ranking", "rechazo", "exportar", "csv", "kpi", "historico"],
    answer:
      "En «Estadísticas» encuentras KPIs anuales (campeonatos, plazas, cubiertas, jueces), cruce de zonas, top de jueces, tasa de rechazo y exportación a CSV para análisis externo.",
    links: [{ label: "Estadísticas", href: "/analytics" }],
  },
  {
    id: "regulations",
    question: "¿Dónde consulto la normativa?",
    keywords: ["normativa", "reglas", "reglamento", "ipf", "requisitos", "guia", "baremo"],
    answer:
      "En «Normativa» hay tres pestañas: Guía AEP 2026, Compensación de jueces (baremo, km, alojamiento, montaje sistema) y Reglamento técnico IPF (buscable por artículo).",
    links: [{ label: "Normativa", href: "/regulations" }],
  },
  {
    id: "compensation-hub",
    question: "¿Dónde está el panel de compensación?",
    keywords: ["compensacion", "panel", "facturacion", "recibos", "financiero", "hub", "km pendientes"],
    answer:
      "El rol responsable financiero de jueces (y super_admin) accede a «Compensación» en el menú lateral. Lista todos los campeonatos con jueces en tarima, km pendientes, estado y total confirmado. Pulsa Abrir para gestionar cada campeonato.",
    links: [{ label: "Compensación", href: "/compensation" }],
    roles: ["super_admin", "responsable_financiero_jueces"],
  },
  {
    id: "compensation-claims",
    question: "¿Cómo gestiono la compensación de un campeonato?",
    keywords: ["km", "kilometraje", "comparte", "montaje", "mont", "alojamiento", "club", "organizador", "desglose", "funciones"],
    answer:
      "Abre el campeonato desde Compensación o su pestaña de compensación. Configura clubes organizadores (listado curado AEP, varios clubes posibles) y e-mails del recibo. Introduce km ida+vuelta manualmente por juez. Marca Comparte si viaja en vehículo compartido (solo exime km al pasajero; los km siguen sirviendo para alojamiento). Marca Mont. si monta el sistema informático (Liftingcast/OpenLifter/Goodlift) con importe manual; es distinto del puesto ordenador en tarima. Expande cada fila para ver el desglose por sesión y posición (S1 Central, Pesaje…).",
    links: [{ label: "Compensación", href: "/compensation" }],
    roles: ["super_admin", "responsable_financiero_jueces"],
  },
  {
    id: "compensation-export",
    question: "¿Cómo exporto el recibo PDF de compensación?",
    keywords: ["recibo", "pdf", "iban", "exportar recibo", "factura", "pago"],
    answer:
      "En la tabla de compensación pulsa «Exportar recibo» en la fila del juez. En el modal introduce el IBAN (se valida el formato; no se guarda en la aplicación) y descarga el PDF con la plantilla AEP o club según el organizador. El PDF no incluye desglose línea a línea; el desglose lo ves en pantalla antes de exportar.",
    links: [{ label: "Normativa compensación", href: "/regulations" }],
    roles: ["super_admin", "responsable_financiero_jueces"],
  },
  {
    id: "compensation-readiness",
    question: "¿Por qué no puedo confirmar los totales de viaje o alojamiento?",
    keywords: ["pendiente", "km incompletos", "confirmar", "total", "bloqueado", "financial"],
    answer:
      "Los importes de viaje y alojamiento no se confirman hasta que todos los jueces tengan los km ida+vuelta completos (enteros). Revisa el indicador de preparación del campeonato y completa clubes/e-mails si el organizador es un club.",
    roles: ["super_admin", "responsable_financiero_jueces"],
  },
  {
    id: "manage-users",
    question: "¿Cómo gestiono usuarios de la plataforma?",
    keywords: ["usuarios", "cuentas", "roles", "activar", "desactivar", "admin", "resetear"],
    answer:
      "En «Usuarios» (solo super_admin y delegado de jueces) puedes crear cuentas, asignar rol y zona, activar/desactivar, editar, resetear contraseña (icono llave) o eliminar. Solo un super_admin puede resetear a otro super_admin.",
    links: [{ label: "Usuarios", href: "/admin/users" }],
    roles: ["super_admin", "delegado_jueces"],
  },
  {
    id: "roles-zones",
    question: "¿Qué puede hacer cada rol?",
    keywords: [
      "zona",
      "permiso",
      "permisos",
      "rol",
      "roles",
      "delegado",
      "editar",
      "otra zona",
      "alcance",
      "restriccion",
      "acceso",
      "solo ver",
      "financiero",
      "no puedo editar",
    ],
    answer:
      "Los delegados de zona solo gestionan campeonatos y jueces de su propia zona; no pueden editar datos de otra zona. El Comité de Jueces y el Super Admin tienen alcance nacional. Responsable financiero: compensación y recibos. Solo lectura: consulta sin modificar. Los permisos se revalidan en el servidor en cada operación.",
    links: [{ label: "Roles y permisos", href: "/docs#roles" }],
  },
  {
    id: "common-errors",
    question: "Errores frecuentes y cómo resolverlos",
    keywords: ["error", "falla", "no funciona", "423", "escaneado", "solo lectura", "8mb", "problema"],
    answer:
      "PDF de cuadrante sin jueces detectados: suele ser un escaneado; vuelve a exportarlo con texto seleccionable o asigna a mano. Campeonato pasado: queda en solo lectura (error 423 al editar). Excel de jueces muy grande: límite ~8 MB. No ves Usuarios: solo AEP Nacional. Tarima aprobada sin editar: usa Registrar imprevisto.",
    links: [{ label: "Documentación", href: "/docs" }],
  },
  {
    id: "help-assistant",
    question: "¿Cómo funciona el asistente de ayuda?",
    keywords: ["asistente", "ayuda", "chat", "pregunta", "widget", "bot"],
    answer:
      "Pulsa el icono de ayuda (esquina inferior derecha). La pestaña Guía muestra primeros pasos según tu rol. La pestaña Asistente responde preguntas sobre el uso de la plataforma; cuando hay IA configurada la usa con estas guías como referencia, y si no, responde con búsqueda local en la documentación curada.",
    links: [{ label: "Documentación", href: "/docs" }],
  },
  {
    id: "privacy",
    question: "¿Cómo se tratan mis datos? (privacidad)",
    keywords: ["privacidad", "datos", "rgpd", "proteccion", "derechos", "tratamiento", "personales", "cookies"],
    answer:
      "La AEP es responsable del tratamiento. Se tratan datos identificativos y federativos de los jueces para organizar el arbitraje. Solo cookies técnicas de sesión. Tienes derecho de acceso, rectificación, supresión, oposición, limitación y portabilidad.",
    links: [
      { label: "Privacidad y datos", href: "/docs#privacidad" },
      { label: "Contacto", href: "/docs#contacto" },
    ],
  },
  {
    id: "contact",
    question: "¿Con quién contacto si tengo dudas?",
    keywords: ["contacto", "ayuda", "soporte", "comite", "duda", "consulta", "escribir", "email"],
    answer:
      "Para consultas sobre la plataforma o tus datos, contacta con el Comité de Jueces de la AEP a través de los canales oficiales de la federación (powerhispania@gmail.com).",
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
      if (keywordSet.has(t)) score += 0.5;
    }
    if (role && entry.roles && entry.roles.includes(role)) score += 0.3;

    results.push({ entry, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
