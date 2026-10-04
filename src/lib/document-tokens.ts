/**
 * Tokens de los documentos que salen de la app: el cuadrante imprimible, el
 * recibo en PDF y los correos de acceso.
 *
 * Ahí no llegan las variables CSS de tokens.css (un correo no carga hojas de
 * estilo; PDFKit pinta con valores, no con clases), así que los colores viven
 * aquí, con nombre, en vez de repartidos como hex sueltos por cada plantilla.
 * Los de marca reflejan los primitivos de tokens.css (tema claro); un test
 * comprueba que coinciden.
 */

/** Marca: los mismos valores que los primitivos de tokens.css. */
export const BRAND = {
  red: "#c23429", // --aep-red-600
  redSoft: "#fbe6e3", // --aep-red-100
  ink: "#18181b", // --neutral-900
  muted: "#6f6f78", // --neutral-500
  border: "#e4e4e7", // --neutral-200
  surface: "#fafafa", // --neutral-50
  paper: "#ffffff", // --neutral-0
} as const;

/**
 * Papel impreso (cuadrante y recibo): tinta negra sobre blanco, como el
 * documento oficial que sustituyen. El rojo y el azul son los del cuadrante
 * Excel de la AEP (horarios en rojo, sede en azul).
 */
export const PRINT = {
  ink: "#000000",
  paper: "#ffffff",
  rule: "#333333", // filetes del recibo
  muted: "#555555", // pie del documento
  faint: "#777777", // avisos vacíos
  hairline: "#cccccc",
  red: "#C00000", // horarios y fecha del cuadrante oficial
  redHover: "#9c0000",
  navy: "#1F4E79", // sede del cuadrante oficial
} as const;

/**
 * Colores por función del cuadrante oficial AEP: el rol no se rotula por
 * columna, se reconoce por el color de la fila y la leyenda. Son los de la
 * plantilla Excel de la federación (en mayúsculas, como los exporta Excel)
 * y no se cambian por gusto.
 */
export const QUADRANT_ROLE_FILL = {
  central: "#FF0000",
  lateral: "#FFFF00",
  ordenador: "#FFC000", // naranja claro
  liftingcast: "#92D050",
  speaker: "#ED7D31", // naranja oscuro
  mesa: "#ED7D31",
  control: "#00B050",
  pesaje: "#A6611A", // marrón
  equipamiento: "#8EAADB",
  jurado: "#BFBFBF",
  material: "#D9D9D9",
} as const;
