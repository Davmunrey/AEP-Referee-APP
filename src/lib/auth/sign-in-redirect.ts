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
