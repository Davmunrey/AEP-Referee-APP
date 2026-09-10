/**
 * No se ha podido LEER el perfil de la aplicación.
 *
 * Distinto de «este usuario no tiene perfil activo», que es una respuesta y se
 * traduce en «tu cuenta no tiene acceso». Un fallo de lectura no dice nada
 * sobre la cuenta: decirlo en su nombre manda a alguien con acceso a pedirle
 * permisos a un administrador que ya se los dio.
 *
 * Vive en su propio módulo —y no en `lib/auth/session`— para que quien solo
 * necesita reconocer el error no arrastre el cliente de servicio de Supabase.
 */
export class SessionProfileReadError extends Error {
  constructor(detalle: string) {
    super(`No se pudo leer el perfil de la sesión: ${detalle}`);
    this.name = "SessionProfileReadError";
  }
}
