# QA y seguridad

Última revisión: octubre 2026 (v2.4). Alcance: repo, CI GitHub, flujos de usuario recorridos pantalla a pantalla (escritorio y móvil a 375 px).

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

## Veredicto

App **operativa en producción** en Vercel. CI verde, **1233 tests** (1234 con 1 skip, 200 archivos, Vitest), lint OK, typecheck OK (tests incluidos), build OK. Migraciones en el repositorio y aplicadas en producción hasta `039`; el job «Reproducir migraciones» las aplica todas sobre un Postgres limpio en cada PR, y lo realmente aplicado en Supabase lo comprueba `npm run audit:remote`.

## QA operativo

| Área | Estado | Notas |
|---|---|---|
| Login | OK | `POST /auth/login` server-side; rate-limit IP+email |
| Dashboard | OK | KPIs, salud, recomendaciones; sincronización en vivo |
| Dashboard zonal | OK | `delegado_zona` acotado por macrozona |
| Campeonatos | OK | Alta, dedupe, import calendario con preview |
| Tarima | OK | Plantilla, cuadrante, asignación, imprevistos, badges compactos. Una tarima nueva arranca en «Plantilla» y no deja enviar a aprobación sin plantilla ni jueces |
| Realtime | OK | Cambios propagados entre usuarios (Supabase Realtime + poll 30 s) |
| Conflictos sesión | OK | Tarima+tarima bloqueado; tarima+pesaje forzable con confirmación |
| Imports horario | OK | Merge parcial de sesiones |
| Cuadrantes | OK | Parser por geometría; 4 formatos AEP |
| Normativa | OK | 4 pestañas en `/regulations` |
| Domicilio OSM | OK | Autocomplete API servidor; eliminar ubicación guardada |
| Compensación | OK | Hub batch, km manual, montaje sistema, export PDF IBAN efímero; liquidaciones pagadas bloqueadas (`423`) |
| Soporte | OK | Tickets con fotos, hilo de comentarios, adjuntos en bucket privado con URL firmada |
| Móvil | OK | Cajón de navegación; sin desbordes horizontales en ninguna ruta a 375 px |
| Ayuda | OK | Widget guía por rol + buscador local de temas (sin IA) |
| Usuarios / contraseñas | OK | Self-change + admin-reset |
| Ascensos / aprobaciones | OK | Decisión booleana obligatoria y motivo obligatorio al rechazar |
| Rendimiento | OK | Consultas optimizadas, caché estática, índices Postgres |

## Ciberseguridad

| Control | Estado |
|---|---|
| Auth middleware | OK |
| API `requireApiUser` | OK |
| RBAC mutaciones | OK |
| RBAC zona (`resolveZoneCode`) | OK — fail-closed |
| RLS Supabase | OK, deny-by-default |
| RLS endurecido (`033`) | OK — políticas permisivas eliminadas en `referee_sanctions` y `competition_availability`; solo servidor (`service_role`). Advisors sin los 2 WARN previos |
| Login brute force | Mitigado |
| CSP | OK — mapas solo vía API propia |
| IBAN compensación | OK — efímero, no persiste |
| Imports PDF/XLSX | OK — límites y preview |
| RLS restos (`037`) | OK — sin políticas `USING (true)` en `activity_log`, `roster_history`, `referee_availability` |
| Tablas nuevas con RLS | OK — un test falla si una `CREATE TABLE` no activa RLS |
| Alta de cuentas (`038`) | OK — la bandera `invited` de los metadatos (que escribe el propio usuario) ya no activa la cuenta |
| Adjuntos | OK — tipo por firma binaria, 5 MB, 5 por envío |
| Realtime `app_sync_state` | OK — solo SELECT authenticated |
| Leaked Password Protection | Pendiente — único item de seguridad abierto; toggle manual en Supabase Auth (HaveIBeenPwned), no es código |

## Invariantes cubiertas por tests de regresión

Clases de fallo que la aplicación ya no puede volver a cometer en silencio.
Cada una tiene su fichero en `tests/regression-batch-*`.

| Invariante | Por qué importa |
|---|---|
| Una lectura fallida nunca se lee como «no hay nada» | `supabase-js` no lanza: devuelve `{data:null,error}`. Por esa vía un corte de red vaciaba el censo, levantaba una sanción, presentaba un hilo de soporte sin respuestas o imprimía un cuadrante sin un solo juez |
| Las lecturas grandes van paginadas | PostgREST corta en 1000 filas: el máximo de un id, un contador o un total se calculaba sobre un trozo arbitrario |
| El dinero pagado congela el puesto en la tarima | Por todas las puertas: asignar, liberar, vaciar, importar cuadrante, cambiar la plantilla y recalcular |
| Nadie pisa el trabajo de otro sin enterarse | Compare-and-set en huecos, liquidaciones, propuestas de aprobación y ascensos; 409 en vez de sobrescritura muda |
| Las zonas se comparan canonicalizadas | Las columnas `zona` de informes, ascensos y propuestas son texto libre con códigos legados anteriores a la 013 |
| La PII se recorta también en las páginas | El recorte por rol vivía solo en las rutas API, y quien entrega el censo al navegador es la página |
| Un `catch` que avisa no tira el mensaje del servidor | El servidor dice qué falta; enseñar un genérico deja al usuario sin salida |
| Paridad memoria/Supabase | El backend de desarrollo corta donde corta producción, no donde le apetece |
| Las fechas son del calendario español | El servidor corre en UTC; «hoy», el inicio de una sanción o qué campeonato es «próximo» se calculan en `Europe/Madrid` |
| Una fecha que no existe es un 400 | `2026-02-30` se rechaza en campeonatos, sanciones y exámenes en lugar de desbordarse al mes siguiente |
| La decisión de una revisión es booleana | `"false"` como texto se leía como aprobación |
| Las migraciones se reproducen enteras en CI | Una migración que asume un esquema que producción no tiene falla en el PR, no en `main` |

## Riesgos vivos (backlog)

- `xlsx` mantiene advisories sin fix upstream público.
- `braces` (dependencia de desarrollo de la cadena de build) tiene un advisory sin versión corregida compatible; está en la lista permitida de `scripts/security-audit.mjs` con su justificación (`GHSA-vfj7-8cjw-p6xm`). `brace-expansion` y `fast-uri` se fuerzan a versiones corregidas con `overrides`.
- OCR/PDF depende de herramientas del entorno serverless en algunos casos.
- E2E profundo (import → cuadrante → export) pendiente.
- E2E smoke compensación pendiente.

## Comandos verificación (mantenedores)

```bash
npm run verify
npm run e2e
npm run audit:remote
```

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.4
