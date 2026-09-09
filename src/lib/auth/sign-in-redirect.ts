/**
 * Adónde manda la aplicación a quien no tiene acceso, y cómo lo reconoce el
 * middleware.
 *
 * Vive en su propio módulo, y no en `lib/auth/session`, porque el middleware
 * corre en el runtime edge y ese módulo arrastra el cliente de servicio de
 * Supabase y `react/cache`.
 *
 * El problema que resuelve: hay dos redirecciones que se persiguen. El
 * middleware manda a `/` a quien tiene cookie de auth válida; el layout del
 * panel manda a `/sign-in` a quien no tiene perfil ACTIVO. Una cuenta
 * autenticada pero inactiva —la que resulta de registrarse por tu cuenta, que
 * ahora nace siempre inactiva— cumple las dos condiciones a la vez, y el
 * navegador acababa en ERR_TOO_MANY_REDIRECTS sin decir nada.
 *
 * Con esta marca el middleware deja pasar a `/sign-in`, y la pantalla explica
 * lo que pasa y cierra la sesión de auth que quedó suelta.
 */
export const SIN_ACCESO_PARAM = "estado";
export const SIN_ACCESO_VALUE = "sin-acceso";

/** Destino de las páginas del panel cuando `getSession()` no da usuario. */
export const SIGN_IN_SIN_ACCESO = `/sign-in?${SIN_ACCESO_PARAM}=${SIN_ACCESO_VALUE}`;

/** ¿Viene esta petición de esa redirección? */
export function esRetornoSinAcceso(params: URLSearchParams): boolean {
  return params.get(SIN_ACCESO_PARAM) === SIN_ACCESO_VALUE;
}

/**
 * Los avisos que la pantalla de acceso sabe mostrar, por código.
 *
 * Antes el texto viajaba en la URL y se pintaba tal cual: `?error=…` lo pone
 * cualquiera, y `/auth/callback` reenviaba ahí el `error_description` del
 * proveedor de identidad, que también llega por la URL. React escapa el HTML,
 * así que no había ejecución de código; pero sí un cartel con el aspecto de un
 * mensaje oficial de la aplicación, en su dominio y bajo su logotipo, con el
 * texto que eligiera quien mandara el enlace («tu cuenta está bloqueada,
 * escribe a…»). Eso es el material del que se hace una suplantación.
 *
 * Ahora por la URL solo viaja un código de esta tabla; el texto lo pone la
 * aplicación.
 */
export const MENSAJES_ACCESO: Record<string, string> = {
  "enlace-invalido": "El enlace no es válido o ha caducado. Pide uno nuevo.",
  "sesion-fallida": "No se pudo iniciar sesión. Inténtalo de nuevo.",
};

/** Texto para un código de `?error=`, o `null` si no viene ninguno. */
export function mensajeDeAcceso(codigo: string | null): string | null {
  if (!codigo) return null;
  return MENSAJES_ACCESO[codigo] ?? "No se pudo iniciar sesión. Inténtalo de nuevo.";
}
