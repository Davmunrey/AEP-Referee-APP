# Convención de imports y exports — AEP Tarima

Plantilla y reglas para que **imports y exports sean consistentes en todo el
proyecto** y no se pierda nada por el camino. Derivada de los patrones reales del
código (Next.js 15 App Router · React 19 · TypeScript estricto) y de lo que ya
fuerza `tsc` + `eslint` (`next/core-web-vitals`, `next/typescript`).

> Regla de oro: `tsc --noEmit` + `eslint src` en verde ya garantizan que **todo
> import resuelve**, que **nada importado queda sin usar** y que **ningún símbolo
> referenciado falta**. Esta guía cubre lo que las herramientas no imponen: orden,
> forma y fronteras.

---

## 1. Rutas de import: alias `@/`, relativo solo dentro del módulo

- **Siempre `@/…`** para importar entre carpetas/feature distintas.
- **Relativo `./x`** solo entre ficheros de la **misma** carpeta-feature
  (p. ej. dentro de `src/lib/judge-compensation/**`, `src/lib/judges-registry/**`,
  `src/lib/schedule-parser/**` o `src/server/services/**`).
- Nunca `../../..` para saltar de feature a feature: usa el alias.

```ts
// ✅ entre features → alias
import { resolveZoneCode } from "@/lib/aep-zones";
import { dataService } from "@/server/services";

// ✅ dentro de la misma feature → relativo
import { travelAmountFromKm } from "./rates";
import type { CompensationClaim } from "./types";

// ❌ evitar
import { resolveZoneCode } from "../../../lib/aep-zones";
```

## 2. Orden de imports (de fuera hacia dentro)

Bloques separados, del más externo al más propio, y los **type-only al final**:

1. Node / librerías externas (`react`, `next/*`, `zod`, `lucide-react`, `@supabase/*`)
2. `@/lib/**` (dominio y utilidades)
3. `@/server/**` (capa de datos/servicios — **solo en servidor**, ver §6)
4. `@/components/**`, `@/hooks/**` (solo cliente/UI)
5. `import type { … }` (tipos, normalmente de `@/lib/types` o `./types`)

```ts
import { z } from "zod";
import { canManageCompensation } from "@/lib/auth/session";
import { isSessionUser, requireApiUser } from "@/lib/api/auth";
import { jsonError, jsonOk } from "@/lib/api/route-utils";
import { dataService } from "@/server/services";
import type { Competition, EventType } from "@/lib/types";
```

## 3. Exports: named por defecto, `default` solo para el framework

- **Named exports** para todo (funciones, constantes, tipos, objetos-servicio).
- **`export default`** SOLO donde Next.js lo exige: `page.tsx`, `layout.tsx`,
  `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`,
  `middleware.ts`, `instrumentation*.ts`, y los `*.config.ts`.
- **Route handlers** (`route.ts`): exports named por verbo HTTP —
  `GET`, `POST`, `PATCH`, `PUT`, `DELETE`.

```ts
// route.ts
export async function GET(request: Request) { … }
export async function POST(request: Request) { … }

// page.tsx (única excepción de default)
export default function CompetitionsPage() { … }
```

## 4. Tipos: `import type` / `export type`

- Importa y exporta tipos con la palabra `type` (evita ciclos y coste en runtime).
- Fuente única de tipos de dominio: `@/lib/types`. Tipos locales de una feature:
  `feature/types.ts`.

```ts
import type { SessionUser, UserRole } from "@/lib/types";
export type DataService = typeof supabaseDataService;
```

## 5. Barrels (`index.ts`): superficie pública explícita

- Un `index.ts` reexporta la **API pública** de la feature; el resto son internos.
- Los consumidores importan del barrel cuando existe; los internos entre sí, con
  rutas relativas.
- Reexporta **también los tipos** que forman parte de la API (`export type { … }`).

```ts
// src/lib/judge-compensation/index.ts
export { buildCompensationClaim, calculateCompensationTotals } from "./calculate";
export { travelAmountFromKm, KM_RATE_EUR } from "./rates";
export type { CompensationClaim, CompensationClaimInput } from "./types";
```

> Nota: `ts-prune` marca los reexports de barrel como "no usados" cuando alguien
> importa del módulo original. Es un falso positivo: la línea del barrel es
> superficie pública, no código muerto. **No** los borres por esa señal sola.

## 6. Frontera cliente/servidor (crítico en App Router)

- Módulos **solo-servidor** (`@/server/**`, `@/lib/supabase/admin`, `@/lib/auth/session`,
  cualquiera que use `service_role`, cookies o `fetch` a APIs internas) **nunca**
  se importan desde un componente marcado `"use client"`.
- El cliente habla con el backend **solo** vía `@/lib/api/client*` (fetch a las
  rutas `/api/v1/**`). No importa `dataService` directamente.
- Un componente cliente empieza con `"use client";` en la primera línea.

```ts
// ✅ servidor (route.ts, server component, service)
import { dataService } from "@/server/services";

// ✅ cliente (component.tsx con "use client")
import { api } from "@/lib/api/client";
```

## 7. Contrato de la capa de datos

Los dos backends (`supabaseDataService`, `memoryDataService`) comparten el tipo
`DataService`. Cualquier método nuevo se añade **a los dos** y el `satisfies` de
`src/server/services/index.ts` lo verifica en compilación:

```ts
export type DataService = typeof supabaseDataService;
void (memoryDataService satisfies DataService); // falla si divergen
export const dataService: DataService = isSupabaseConfigured()
  ? supabaseDataService
  : memoryDataService;
```

## 8. Sin duplicar exports (una sola fuente de verdad)

- Un símbolo, un módulo. Si dos módulos exportan lo mismo con el mismo nombre,
  uno sobra (o hay que renombrar). Ej. corregido: `canManageUsers` vivía en
  `@/lib/auth/session` **y** en `@/lib/permissions`; se dejó solo el primero.
- Constantes/enunciados de dominio (roles, niveles, zonas) se derivan de una
  única fuente: p. ej. `USER_ROLES` deriva de `ROLE_LABELS` en `@/lib/types`.

## 9. Variables/parámetros sin usar: prefijo `_`

Configurado en `eslint.config.mjs`. Úsalo para argumentos que la firma exige pero
la implementación ignora (típico en stubs del modo memoria):

```ts
export async function GET(_request: Request, context: RouteContext) { … }
```

---

## Checklist antes de commitear

- [ ] `npx tsc --noEmit` limpio (imports resuelven, tipos cuadran).
- [ ] `npx eslint src` limpio (sin imports/vars sin usar).
- [ ] Nuevos métodos de datos añadidos a **ambos** backends (`satisfies` verde).
- [ ] Ningún `import` de `@/server/**` dentro de un `"use client"`.
- [ ] Imports ordenados por §2; tipos con `import type`.
- [ ] Ningún export duplicado del mismo símbolo en dos módulos.
