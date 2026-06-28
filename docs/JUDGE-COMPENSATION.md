# Compensación de gastos de jueces (AEP)

Fuente normativa: [Criterios Compensación Gastos Jueces (31/10/2025)](https://powerliftingspain.es/wp-content/uploads/2025/10/20251031_Criterios-Compensacion-Gastos-Jueces.pdf).

## Responsable

La compensación económica la gestiona el rol **`responsable_financiero_jueces`** (Responsable Financiero Jueces), **no** el delegado de zona ni el delegado de jueces. El `super_admin` puede intervenir como respaldo administrativo.

## Objetivo

Calcular y gestionar la compensación económica por campeonato de cada juez asignado en tarima: funciones por **posición en tarima** (Central, Lateral, Ordenador, Pesaje, etc.), desplazamiento, alojamiento, **montaje del sistema informático** (aparte) y responsable de competición.

## Baremo vigente (código: `src/lib/judge-compensation/rates.ts`)

| Concepto | AEP-3 | AEP-2 | AEP-1 | EPF/IPF |
|---|---:|---:|---:|---:|
| Pesaje | 15 € | 15 € | 20 € | 20 € |
| Sesión (tarima) | 30 € | 30 € | 40 € | 40 € |
| Montaje sistema | Importe manual (Liftingcast / OpenLifter / Goodlift) |
| Km ida+vuelta | 0,13 €/km | | | |
| Alojamiento / día | 25 € | | | |
| Responsable competición | 20 € / campeonato | 20 € | 20 €* | 0 € |

\* AEP-1 responsable: puede ser 20 €/día o dos responsables — decisión del Presidente del Comité (override manual).

### Reglas de negocio

1. **Funciones en tarima**: una línea por **sesión × posición** (`S1` Central, `S1` Ordenador, `S1` Pesaje…). Ocupar la posición ordenador/liftingcast durante el campeonato se paga como cualquier otra función de tarima.
2. **Montaje del sistema informático**: caso aparte — checkbox **Mont.** + importe manual. Es montar/configurar Liftingcast, OpenLifter o Goodlift, **no** ocupar la plaza de ordenador en sesión.
3. **Desplazamiento**: solo si el juez viaja **exclusivamente como juez**. Un vehículo compartido → **un solo** desplazamiento pagado en kilometraje (`shared_vehicle_passenger` en pasajeros).
4. **Km**: **introducción manual** por juez (ida+vuelta, enteros). No se usa geocodificación de sede ni cálculo automático en compensación.
5. **Comparte vehículo**: **solo exime el cobro de kilometraje**; los km siguen siendo obligatorios y se usan para calcular alojamiento.
6. **Alojamiento**: ida+vuelta **> 150 km** y **≥ 2 funciones**. 25 € × días de campeonato. Aplica aunque el juez comparta vehículo.
7. **Internacional EPF/IPF**: hotel oficial fuera de este cálculo; `ambito: epf|ipf` en competición.

## Recibo PDF (export por juez)

Plantilla alineada con los recibos reales AEP/club. Dos cabeceras:

| Tipo | Cabecera | Devolución |
|---|---|---|
| **Club** | Nombre del club + línea AEP | `compensationClubEmail` del campeonato |
| **AEP** | Membrete AEP nacional | JuecesAEP / TesoreroAEP / PresidenteAEP |

Campos del campeonato (`compensationOrganizer`, `compensationClubName`, `compensationClubEmail`, `compensationVolunteer`) configuran el texto del recibo.

### IBAN — no se almacena

El **número de cuenta (IBAN) no existe en la base de datos ni en perfiles de juez**. Solo se solicita al pulsar **Exportar recibo**; viaja en la petición HTTP, se inserta en el PDF generado y **no se persiste ni se registra** en logs.

```
POST /api/v1/competitions/:id/compensation/:refereeId/export
Body: { "iban": "ES28 0182 …" }   ← efímero
→ application/pdf
```

Código: `src/lib/judge-compensation/receipt-document.ts`, `receipt-pdf.ts`, `iban.ts`.

## Modelo de datos (migrations `024`–`027`)

| Tabla / columna | Uso |
|---|---|
| `referees.domicilio`, `domicilio_lat`, `domicilio_lng` | Referencia del juez (opcional; km manual en compensación). Borrables desde ficha con «Eliminar ubicación» → `NULL` en los tres campos |
| `competitions.ambito`, `compensation_*` | Baremo y metadatos del recibo |
| `judge_compensation_claims` | Una fila por juez × campeonato; `is_computer_setup`, `computer_setup_amount` |
| `judge_compensation_duty_lines` | Desglose por sesión × posición (`role_key`, `role_label`) |

Estados del claim: `borrador` → `enviado` → `aprobado` → `pagado` / `rechazado`.

## Arquitectura

```
Roster assignments + template
        ↓
classifyDuties()  →  duty lines (posición tarima por sesión)
        ↓
Km manual por juez  →  ida+vuelta enteros
        ↓
calculateClaim()  →  importes (+ ordenador manual si aplica)
        ↓
judge_compensation_claims (persistido, sin IBAN)
        ↓
Export PDF + IBAN introducido al vuelo
```

## API

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/compensation/hub` | `canManageCompensation` — panel central |
| `GET` | `/competitions/:id/compensation` | `canManageCompensation` |
| `POST` | `/competitions/:id/compensation/recalculate` | `canManageCompensation` |
| `PATCH` | `/competitions/:id/compensation/:refereeId` | `canManageCompensation` — km, comparte, ordenador, resp. |
| `POST` | `/competitions/:id/compensation/:refereeId/export` | `canManageCompensation` — body `{ iban }` |

## UI

- **Panel central** `/compensation` — lista todos los campeonatos con jueces, km pendientes y enlace directo.
- Página `/competitions/[id]/compensation` (solo responsable financiero / super_admin).
- **Mont.** para montaje del sistema (Liftingcast / OpenLifter / Goodlift), con importe manual. Distinto de la posición ordenador en tarima.
- Desglose por **Sx** con la **posición real** (Juez Central, Pesaje, Lateral…); columna funciones tipo `S1(Cent+Pz) · S2`.
- Clubes organizadores desde listado curado (~180 clubes AEP en `src/lib/aep-clubs-curated.ts`).
- Totales bloqueados hasta completar todos los km (modo `none` exento).
- Exportar recibo → modal con IBAN → PDF (sin desglose línea a línea en el PDF; desglose en pantalla).
- Baremo también en **Normativa** → pestaña Compensación de jueces.

Ver captura: `docs/images/10-compensacion.png`.

## Tests

- `tests/judge-compensation.test.ts` — baremo, ordenador manual y totales.
- `tests/judge-compensation-km.test.ts` — km manual, comparte y alojamiento.
- `tests/judge-compensation-breakdown.test.ts` — desglose por posición en tarima.
- `tests/judge-compensation-receipt.test.ts` — texto del recibo e IBAN efímero.
- `tests/compensation-hub.test.ts` — panel central.

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v1.8
