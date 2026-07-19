# Changelog — AEP Tarima

Historial de versiones desplegadas de la plataforma de gestión de jueces de la
Asociación Española de Powerlifting. Cada versión corresponde a un despliegue en
producción (`main` → [aep-tarima.vercel.app](https://aep-tarima.vercel.app/)).

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/) adaptado al
proyecto; los cambios se agrupan en **Añadido**, **Corregido**, **Rendimiento**,
**Diseño/UX** y **Seguridad**.

---

## [v2.1] — Sin publicar (PR #72, en revisión)

Auditoría integral en cinco rondas: caza de bugs, rendimiento, pulido visual,
lógica de negocio y persistencias. La suite pasa de 356 a ~400 tests.

### Corregido
- **Alta de jueces rota tras cualquier borrado**: el id se generaba con
  `count(*)+1` y colisionaba con claves existentes; ahora `max(jN)+1` con
  reintento ante altas concurrentes. Mismo criterio en campeonatos (`evt-NNN`).
- **Cierres de sesión aleatorios**: el middleware descartaba las cookies del
  token de refresco recién rotado en redirecciones y respuestas 401.
- **Login colgado ante un fallo de red** (botón bloqueado sin mensaje).
- **Doble revisión concurrente** de aprobaciones de tarima y ascensos: solo
  gana el primer revisor (guard condicional por estado).
- IDs de propuestas/exámenes/informes/historial con `randomUUID` (antes
  `Date.now()`, que colisionaba y perdía historial en silencio).
- La caché de zonas/normativa ya no persiste una lista vacía durante 1 h tras
  un fallo puntual de Supabase; las sondas de columnas legacy no cachean
  errores transitorios.
- Códigos de estado correctos en la API: duplicados → 409, errores de negocio
  → 400 (antes 500 genérico), body JSON malformado → 400, signout con 303.
- El PATCH de campeonatos valida lo mismo que el POST (rangos, fechas, enums);
  la puntuación de exámenes se limita a la puntuación máxima real del examen.
- Sanciones calculadas en hora española (`Europe/Madrid`): expiraban y
  activaban con 1–2 h de deriva respecto a la medianoche local.
- Parsers de calendario: los meses escritos completos («septiembre»,
  «noviembre»…) no se reconocían y la entrada se perdía sin aviso.
- Historial de competiciones de un juez corrupto con sesiones que contienen
  guion bajo; falso bloqueo de solape tarima→pesaje entre días distintos.
- Importación del censo: fechas US coladas como ISO inválido, rangos que
  cruzan el año (Dic→Ene), CSV con `;` (Excel español) que descartaba todas
  las filas en silencio, teléfonos que perdían el 0 inicial o el prefijo +34,
  y niveles IPF con variantes de escritura degradados a Regional sin aviso.
- Compensaciones: fijar días de alojamiento manualmente ahora concede el
  alojamiento (antes quedaba en 0 € sin aviso si no se marcaba también la
  elegibilidad); los días de campeonato ya no se etiquetan como 1 al recargar.
- Backend de desarrollo: el estado de aprobación no se persistía (mutación
  sobre una copia) y el almacén de compensaciones se perdía con el HMR.

### Rendimiento
- `pdfkit` y `xlsx` fuera del arranque en frío de **todas** las rutas API
  (solo se cargan en las 2 rutas que los usan).
- Importación del censo: de ~900 consultas a ~15 (mapas precargados + lotes).
- Importación de calendario de O(N²) a O(N); asignación de jueces con lecturas
  paralelizadas y sin trabajos redundantes; exportaciones (acta, cuadrante
  HTML/Excel) cargan solo los jueces asignados, no el censo completo.
- Barrido de sanciones caducadas con limitación de frecuencia (corría en cada
  listado y cada dashboard); cliente admin de Supabase como singleton;
  historial de tarima acotado; listado de usuarios de admin paginado.
- Admin de usuarios precargado desde el servidor (sin destello de carga);
  breadcrumb con caché de nombre; diálogos pesados descargan su código solo
  al abrirse; `React.memo` en tarjetas de juez y bloques de sesión.

### Diseño/UX
- Auditoría visual completa por zonas (93+ hallazgos aplicados): tokens de
  color exactos en toda la app (sin colores crudos ni opacidades sueltas),
  contraste AA en microtextos, un solo `h1` por página, radios y overlays de
  diálogo unificados, foco visible (`focus-ring`) en ~50 interactivos.
- **Teclado**: el flujo completo de asignación de tarima es operable sin ratón
  (huecos y tarjetas de juez con Enter/Espacio); los diálogos de administración
  cierran con Escape.
- **Pantallas esqueleto** en todas las rutas (incluido el dashboard raíz, que
  era un simple spinner), imitando la estructura real de cada página.
- Estados honestos: indicadores reales de carga y error en compensación y
  administración (antes mostraban vacíos engañosos), estados vacíos ricos,
  «Sin plantilla» en lugar de un 0 % confuso.
- La tabla de compensación ancha se desplaza en vez de recortar columnas; el
  calendario operativo ya no desborda en móvil.

### Añadido
- Migración `034`: columna para el ajuste manual del importe de viaje
  (`travel_amount_override`, ahora persistido de extremo a extremo),
  coordenadas del domicilio del juez (la geocodificación se guarda y no se
  repite contra Nominatim en cada recálculo de km) e índice único que impide
  propuestas pendientes duplicadas. El código funciona igual con o sin la
  migración aplicada (sondas de columna).
- ~45 tests nuevos: baremo completo de tarifas por tipo/ámbito, clasificación
  de funciones, frontera exacta del alojamiento (150 vs 151 km), consistencia
  desglose↔total del recibo, validación compartida de la API y regresiones de
  todos los bugs corregidos en esta versión.

---

## [v2.0] — 12 jul 2026 (PRs #64–#71)

### Añadido
- **Centro de ayuda local**: buscador sobre ~35 temas curados, primeros pasos
  por rol y temas frecuentes — 100 % en el navegador, sin IA ni red (#70).
- Título de pestaña simplificado a «AEP Tarima» (#70).

### Corregido
- Lote de hardening de seguridad + correcciones de bugs con tests de
  regresión (#71).
- El token de refresco caducado se trata como sesión expirada en el middleware
  (fin de los errores ruidosos de autenticación) (#69).
- Vista previa del cuadrante por `srcDoc`, inmune a cabeceras de framing
  (#68); impresión sin encabezado del navegador (#66).

### Seguridad
- Retirada del asistente IA (Gemini) y de sus rutas; políticas RLS permisivas
  eliminadas — los datos sensibles solo se leen desde el servidor (#70, #71).

### Diseño/UX
- El flujo de tarima entra en el paso real según el progreso y la Revisión
  muestra el export del cuadrante (#65).
- Espaciado unificado entre botones y micro-interacciones más suaves con
  shimmer de carga (#63, #64).
- Despliegue restringido a `main` (sin previews de ramas de trabajo) (#67).

---

## [v1.9+] — 6 jul 2026 (PRs #54–#62) · ola de rendimiento

### Rendimiento
- Disponibilidad instantánea en tarima (#54); dedupe y paralelización de
  lecturas en rutas calientes del servidor (#55, #57); memoización y
  code-splitting del cliente (#56, #58); lista ligera de campeonatos y más
  esqueletos de carga (#59).

### Añadido
- Soporte multiaño: temporada = año natural con selector de año en analítica
  (#60); navegación agrupada por dominio en 5 grupos (#61); último inicio de
  sesión y fechas detalladas en administración de usuarios (#62).

---

## [v1.9] — 5 jul 2026 (PRs #46–#53)

### Corregido
- Lote 1 de auditoría: RBAC, integridad del acta, PII, compensación y
  cuadrantes (#46).
- La disponibilidad domina la selección rápida de jueces (#50, #52).
- Recibo AEP con concordancia de género y logo grande (#47).

### Añadido
- Organizador de recibo personalizable + verificación de datos con Supabase
  (#48); reemplazo seguro del censo y selección rápida de jueces (#49);
  arbitrajes por año natural con endurecimiento RLS (#51).

---

## [v1.8] — 28 jun 2026

### Añadido
- Sincronización en tiempo real con Supabase Realtime.
- Botón para eliminar la ubicación del domicilio del juez.

### Rendimiento
- Caché con TTL para zonas/normativa, filtros SQL de árbitros e índices;
  reducción de latencia en consultas y sincronización del cliente.

---

## [v1.7] — 28 jun 2026

### Añadido
- Sección de normativa unificada: Guía AEP, plazas de tarima e IPF.
- Asistente de ayuda actualizado con el estado completo de la plataforma.

### Corregido
- Recibo PDF idéntico a la plantilla oficial AEP (IBAN legible, descarga en
  móvil, sin popup de compartir); campos de km y montaje editables como texto
  numérico; guardado de km al salir del campo sin errores concurrentes.
- Autocomplete de domicilio con OpenStreetMap; badges de nivel abreviados en
  tarima (R, N, I, II).
- Dominio de producción: `aep-tarima.vercel.app`.

---

## Anteriores a v1.7

Los orígenes del proyecto (estructura Next.js + Supabase, módulos de
campeonatos, censo, tarima, aprobaciones, exámenes/ascensos, compensaciones y
documentación) se consolidaron en los despliegues iniciales de junio de 2026,
previos al versionado formal de la documentación.
