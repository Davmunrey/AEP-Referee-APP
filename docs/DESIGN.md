# Sistema de diseño — AEP Tarima

## Principio

**Cero colores hardcodeados en componentes.** Todos los valores visuales viven en `src/styles/tokens.css`. Los componentes usan clases Tailwind semánticas mapeadas en `src/app/globals.css` o helpers de `src/lib/design-tokens.ts`.

## Archivos

| Archivo | Rol |
|---------|-----|
| `src/styles/tokens.css` | Primitivos (`--aep-red-500`, neutros) y semánticos (`--primary`, `--surface`, estados) |
| `src/app/globals.css` | `@theme inline`, utilidades (`app-mesh`, `glass-panel`, `focus-ring`) |
| `src/lib/design-tokens.ts` | Bundles de clases para TSX (`tokens`, `kpiAccentTokens`, `selectFieldClass`) |

## Tokens semánticos principales

### Fondos

- `background` — fondo de app
- `sidebar` — barra lateral / topbar translúcido
- `card` / `surface` — tarjetas y paneles
- `muted` — bloques secundarios

### Marca y acción

- `primary` — rojo AEP (`#e63b2e`)
- `primary-muted`, `primary-border` — estados suaves

### Estados

- `success` / `warning` / `info` / `destructive`
- Cada uno con variantes `-muted` y `-border`

### Tipografía

- `foreground`, `foreground-secondary`
- `muted-foreground`, `subtle`, `subtle-muted`

## Utilidades CSS

| Clase | Uso |
|-------|-----|
| `app-mesh` | Fondo con gradientes radiales (main) |
| `glass-panel` | Panel login / destacados |
| `glass-panel-soft` | Hero dashboard, detalle aprobaciones, tarima header |
| `surface-card` | Card shadcn base |
| `text-gradient-brand` | Titulares de marca |
| `friendly-label` | Eyebrows de sección |
| `focus-ring` | Focus accesible en inputs y botones |
| `transfer-enter` | Entrada de paneles en wizards import/export (respeta `prefers-reduced-motion`) |
| `transfer-row-stagger` | Filas escalonadas en listas de preview |
| `bg-role-*` / `ring-role-*` | Acentos por rol (`super_admin`, `delegado_jueces`, `delegado_zona`, `solo_ver`) |

## Componentes de layout

- **`PageShell`** — contenedor `max-w-[1600px]` con padding
- **`PageHeader`** — eyebrow + título + descripción + acciones

## Componentes UI compartidos

- **`StatCard`** — KPI con acento (red/yellow/blue/neutral)
- **`DataTable`** — tablas con thead unificado
- **`StatusPill`** — pendiente / aprobado / rechazado
- **`EmptyState`** — estados vacíos con icono

## Uso en TSX

```tsx
import { tokens, selectFieldClass } from "@/lib/design-tokens";

<p className={tokens.text.muted}>Texto secundario</p>
<select className={selectFieldClass} />
```

## SVG inline

Usar variables CSS, no hex:

```tsx
stroke="var(--chart-success)"
stroke="var(--chart-track)"
```

Definidas en `tokens.css` como `--chart-success`, `--chart-warning`, `--chart-danger`, `--chart-track`.

## Fuentes

- **DM Sans** — interfaz
- **IBM Plex Mono** — datos tabulares, badges, fechas

Configuradas en `src/app/layout.tsx`.

## Añadir un color nuevo

1. Añadir primitivo en `tokens.css` si hace falta
2. Mapear semántico (`--mi-token: var(--aep-...)`)
3. Exponer en `@theme inline` en `globals.css` como `--color-mi-token`
4. Opcional: añadir a `tokens` en `design-tokens.ts`
5. **No** usar hex en archivos `.tsx`
