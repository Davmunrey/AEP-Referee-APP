# QA y seguridad

Última revisión: septiembre 2026 (v2.0). Alcance: repo, CI GitHub, flujos usuario comunes.

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

## Veredicto

App **operativa en producción** en Vercel. CI verde, **695 tests** (696 con 1 skip, 111 archivos, Vitest), lint OK, build OK. Migraciones en el repositorio hasta `036`; lo realmente aplicado en Supabase lo comprueba `npm run audit:remote`.

## QA operativo

| Área | Estado | Notas |
|---|---|---|
| Login | OK | `POST /auth/login` server-side; rate-limit IP+email |
| Dashboard | OK | KPIs, salud, recomendaciones; sincronización en vivo |
| Dashboard zonal | OK | `delegado_zona` acotado por macrozona |
| Campeonatos | OK | Alta, dedupe, import calendario con preview |
| Tarima | OK | Plantilla, cuadrante, asignación, imprevistos, badges compactos |
| Realtime | OK | Cambios propagados entre usuarios (Supabase Realtime + poll 30 s) |
| Conflictos sesión | OK | Tarima+tarima bloqueado; tarima+pesaje forzable con confirmación |
| Imports horario | OK | Merge parcial de sesiones |
| Cuadrantes | OK | Parser por geometría; 4 formatos AEP |
| Normativa | OK | 4 pestañas en `/regulations` |
| Domicilio OSM | OK | Autocomplete API servidor; eliminar ubicación guardada |
| Compensación | OK | Hub batch, km manual, montaje sistema, export PDF IBAN efímero |
| Ayuda | OK | Widget guía por rol + buscador local de temas (sin IA) |
| Usuarios / contraseñas | OK | Self-change + admin-reset |
| Ascensos | OK | `review_comment` al rechazar |
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

## Riesgos vivos (backlog)

- `xlsx` mantiene advisories sin fix upstream público.
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

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.0
