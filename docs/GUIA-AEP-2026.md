# Guía AEP 2026 — Referencia en AEP Tarima

Resumen operativo extraído de **Guía AEP** (actualización diciembre 2025, temporada 2026). La convocatoria de cada campeonato prevalece si hay discrepancia.

En la app: **Normativa** (`/regulations`) → pestaña **Guía AEP 2026**.

---

## Zonas geográficas (§4.1)

| Zona | Territorios |
|------|-------------|
| Norte 1 | Galicia, Asturias, Castilla y León |
| Norte 2 | Cantabria, País Vasco, Navarra, La Rioja, Aragón |
| Centro | Extremadura, Castilla-La Mancha |
| Madrid | Madrid |
| Cataluña | Cataluña |
| Levante e islas | Valencia, Murcia, Baleares |
| Sur | Andalucía, Ceuta, Melilla |
| Canarias | Canarias |

AEP Tarima usa códigos operativos (MAD, CAT, VAL, …) para delegados de zona; la pestaña Guía relaciona cada código con la zona oficial.

---

## Niveles competitivos (§4.2)

| Nivel | Ámbito |
|-------|--------|
| **AEP-3** | Local — entrada al sistema; plaza por club organizador; premios solo &lt; 85 IPF GL |
| **AEP-2** | Regional (máx. 2/zona/temporada; solo clubes de la zona; MMR) + **Clasificatorio** anual (MMO; acceso Open nacional) |
| **AEP-1** | Nacional — Copa España Open, Cto. España Absoluto, por edad (Subjunior, Junior, Máster) |

Campeonatos con fecha de fin pasada → **solo lectura** en tarima (API `423`).

---

## Cuotas 2026 relevantes para jueces (§2)

| Concepto | Importe |
|----------|---------|
| Licencia básica (jueces en activo, mínimo) | 25 €/año |
| Licencia ordinaria atleta | 75 €/año |
| Examen Juez Nacional AEP | 50 € |
| Inscripción AEP-1 / AEP-2 / clasificatorio | 50 € |
| Inscripción AEP-3 | 30 € |

---

## Marcas mínimas (§5)

Tablas completas en la app (MMR y MMO por categoría de peso). La MMR habilita AEP-2 regional con validez permanente en la categoría conseguida o superiores (con requisitos de subida de categoría).

---

## Documentación complementaria (§11)

- Estatutos AEP  
- Reglamento técnico IPF (en app: pestaña Reglamento IPF)  
- Guía de organización de campeonatos  
- Guía creación de clubes  
- Reglamento disciplinario  

---

*Fuente: documento «GUIA-AEP-2» proporcionado por la federación. Implementación en código: `src/lib/aep-guide-2026.ts`.*
