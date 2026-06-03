# Seguridad del cliente iOS (AEP Tarima)

Resumen de la postura de seguridad de la app nativa.

## Autenticación y sesión
- Login con el **SDK de Supabase** (`signInWithPassword`); el SDK guarda los
  tokens (access + refresh) en el **Keychain** del sistema.
- La app llama a `/api/v1` con `Authorization: Bearer <jwt>`. El backend
  **verifica el JWT en el servidor** (no solo lo decodifica) y aplica el mismo
  RBAC/zona que la web. La app solo usa la **anon key** (pública); nunca la
  `service_role`.
- **Face ID/Touch ID** opcional como puerta de desbloqueo (`LocalAuthentication`).
- 401 → un único intento de refresh de token y reintento; si falla, a login.

## Transporte
- **App Transport Security** activado, sin cargas arbitrarias
  (`NSAllowsArbitraryLoads = false`): todo el tráfico va por **HTTPS/TLS**
  (Vercel y Supabase).

## Datos y permisos
- Permisos declarados con su descripción: cámara (escaneo) y Face ID.
- No se registran datos sensibles (tokens, contraseñas) en logs; el único
  `print` es un error de registro APNs y solo en compilaciones `DEBUG`.
- La autorización de cada acción se **revalida en el servidor**; el gating por
  rol/zona en la UI es solo de experiencia de usuario.

## Configuración
- `Config/Config.xcconfig` contiene solo placeholders no secretos
  (`API_HOST`, `SUPABASE_HOST`, anon key). No hay secretos en el repositorio.
- Las credenciales de firma y la `.p8` de APNs viven en los secrets de CI
  (TestFlight), nunca en el código.

## CI
- Cada cambio en `apps/ios/` compila el núcleo (`swift test`) y la app
  (`xcodebuild`) en macOS. Tests de la capa de red cubren los escenarios de
  fallo (401/refresh, errores del servidor, decode).
