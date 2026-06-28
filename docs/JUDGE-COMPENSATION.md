# Compensación de gastos de jueces (AEP)

Fuente normativa: [Criterios Compensación Gastos Jueces (31/10/2025)](https://powerliftingspain.es/wp-content/uploads/2025/10/20251031_Criterios-Compensacion-Gastos-Jueces.pdf).

## Responsable

La compensación económica la gestiona el rol **`responsable_financiero_jueces`** (Responsable Financiero Jueces), **no** el delegado de zona ni el delegado de jueces. El `super_admin` puede intervenir como respaldo administrativo.

## Objetivo

Calcular y gestionar la compensación económica por campeonato de cada juez asignado en tarima: funciones (sesión/pesaje), desplazamiento (km o alternativas aprobadas), alojamiento y responsable de competición. Generar el **recibo PDF** por juez para devolución al organizador.

## Baremo vigente (código: `src/lib/judge-compensation/rates.ts`)

| Concepto | AEP-3 | AEP-2 | AEP-1 | EPF/IPF |
|---|---:|---:|---:|---:|
| Pesaje | 15 € | 15 € | 20 € | 20 € |
| Sesión (tarima) | 30 € | 30 € | 40 € | 40 € |
| Km ida+vuelta | 0,13 €/km | | | |
| Alojamiento / día | 25 € | | | |
| Responsable competición | 20 € / campeonato | 20 € | 20 €* | 0 € |

\* AEP-1 responsable: puede ser 20 €/día o dos responsables — decisión del Presidente del Comité (override manual).

### Reglas de negocio

1. **Funciones**: se cuentan **sesiones distintas** (`S1`, `S2`…) en las que el juez tiene al menos un rol de tarima (sesión) o de pesaje (pesaje/equipamiento/material).
2. **Desplazamiento**: solo si el juez viaja **exclusivamente como juez**. Un vehículo compartido → **un solo** desplazamiento pagado (`shared_vehicle_passenger` en pasajeros).
3. **Km**: Google Maps Distance Matrix entre domicilio del juez y sede; ida × 2. Override manual permitido.
4. **Alojamiento**: ida+vuelta **> 150 km** y **≥ 2 funciones**. 25 € × días de campeonato.
5. **Internacional EPF/IPF**: hotel oficial fuera de este cálculo; `ambito: epf|ipf` en competición.

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

## Modelo de datos (migration `024`)

| Tabla / columna | Uso |
|---|---|
| `referees.domicilio`, `domicilio_lat`, `domicilio_lng` | Origen desplazamiento |
| `competitions.sede_direccion`, `sede_lat`, `sede_lng`, `ambito` | Destino; baremo |
| `competitions.compensation_*` (migration `025`) | Metadatos del recibo |
| `judge_compensation_claims` | Una fila por juez × campeonato |
| `judge_compensation_duty_lines` | Desglose sesión/pesaje |

Estados del claim: `borrador` → `enviado` → `aprobado` → `pagado` / `rechazado`.

## Arquitectura

```
Roster assignments + template
        ↓
classifyDuties()  →  duty lines
        ↓
Google Distance Matrix (opcional)  →  km ida
        ↓
calculateClaim()  →  importes
        ↓
judge_compensation_claims (persistido, sin IBAN)
        ↓
Export PDF + IBAN introducido al vuelo
```

## API

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/competitions/:id/compensation` | `canManageCompensation` |
| `POST` | `/competitions/:id/compensation/recalculate` | `canManageCompensation` |
| `PATCH` | `/competitions/:id/compensation/:refereeId` | `canManageCompensation` |
| `POST` | `/competitions/:id/compensation/:refereeId/distance` | `canManageCompensation` |
| `POST` | `/competitions/:id/compensation/:refereeId/export` | `canManageCompensation` — body `{ iban }` |

## Variables de entorno

| Variable | Uso |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Distance Matrix API (solo servidor) |

## UI (v1.5)

- Página `/competitions/[id]/compensation` (solo responsable financiero / super_admin).
- Enlace **Compensación** en cabecera de tarima (visible solo con `canManageCompensation`).
- Tabla por juez con totales, overrides km/alojamiento y botón **Exportar recibo** → modal IBAN → descarga PDF.
- Configuración organizador (club/AEP, email devolución, voluntario) en la propia página de compensación.
- Campo **domicilio** en ficha de juez (`referee-edit-form`) para cálculo de desplazamiento.

## Tests

- `tests/judge-compensation.test.ts` — baremo y totales.
- `tests/judge-compensation-receipt.test.ts` — texto del recibo e IBAN efímero.
- `tests/session-rbac.test.ts` — `canManageCompensation`.
