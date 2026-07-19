# Changelog — AEP Tarima

Historial de versiones desplegadas en producción (`main` → [aep-tarima.vercel.app](https://aep-tarima.vercel.app/)).

---

## 🔬 **AEP Tarima v2.1** — _«La Gran Auditoría»_ (sin publicar · PR #72)

Cinco rondas de auditoría con agentes en paralelo peinando cada capa de la app. Encontramos cosas. Muchas cosas. Ya no están.

**Lo gordo — bugs que llevaban tiempo agazapados:**
- **El alta de jueces se rompía para siempre tras borrar uno** — el id se calculaba con `count+1`, que tras un borrado colisionaba con un id ya existente. Para siempre. Ahora `max+1` con reintento. Matemáticas: 1, burocracia: 0.
- **Cierres de sesión aleatorios** — el middleware tiraba a la basura la cookie del token recién renovado al redirigir. El navegador se quedaba con el token viejo, ya invalidado. Misterio resuelto: no eras tú, era el middleware.
- **Dos revisores podían aprobar la misma propuesta a la vez** — ahora solo gana el primero. Las carreras, en la tarima, no en la base de datos.
- **Las sanciones expiraban en horario de Greenwich** — un juez sancionado hasta «hoy» seguía sancionado hasta la 1–2 de la madrugada española. Ahora el reloj oficial es el de Madrid, como debe ser.
- **«septiembre» no existía** — los regex del parser de calendario solo aceptaban meses de 3 a 5 letras. Septiembre, noviembre y diciembre, los meses más largos del año, no se importaban. Sin comentarios.

**La importación del censo ya no miente:**
- CSV exportado con `;` (o sea, cualquier Excel en español) → antes: «0 campeonatos» sin explicación; ahora: se importa.
- Fechas en formato americano coladas como `2026-13-05` → descartadas con educación en vez de guardadas con vergüenza.
- Teléfonos que perdían el 0 inicial y el +34 por leerse como número → un teléfono es texto. Siempre lo fue.
- Jueces «IPF Cat. 2» degradados a Regional por una errata de formato → normalización de variantes. Los ascensos, mejor por méritos que por regex.

**Rendimiento (tokenizado, como pediste):**
- `pdfkit` y `xlsx` ya no se cargan en el arranque en frío de las 56 rutas API. Solo en las 2 que los usan. Las otras 54 respiran.
- Importar el censo: de ~900 consultas a ~15. Importar el calendario: de O(N²) a O(N). Las matemáticas vuelven a estar de nuestro lado.
- Asignar un juez toca la mitad de base de datos que antes; las exportaciones cargan solo los jueces asignados, no el censo entero «por si acaso».
- La geocodificación se guarda: Nominatim ya no recibe la misma pregunta dos veces. Nominatim nos lo agradece.

**Diseño y accesibilidad — 93+ hallazgos aplicados:**
- El flujo completo de asignación funciona **sin ratón** (Enter/Espacio en huecos y tarjetas). Los diálogos cierran con Escape. Bienvenidos a la accesibilidad.
- Foco visible en ~50 interactivos, contraste AA en los microtextos, un solo `h1` por página, cero colores fuera de la paleta de tokens. El check verde del stepper era verde sobre verde: invisible desde su nacimiento. Ahora se ve.
- Pantallas esqueleto en TODAS las rutas — el dashboard cargaba con un spinner solitario; ahora carga con la silueta de sí mismo.
- Estados honestos: la compensación decía «Sin jueces asignados» mientras cargaba. Ahora dice que está cargando. Revolucionario.

**Zona de Soporte (nueva):**
- **Tickets internos con fotos** — cualquier usuario puede abrir un ticket (incidencia, mejora, duda) con descripción y hasta 5 fotos; los admins lo trabajan con un hilo de comentarios (también con fotos), lo marcan en progreso y lo resuelven con nota. Los adjuntos viven en un bucket privado y se sirven con URLs firmadas de 1 hora. Migración 035.

**Además:**
- Migración 034: el ajuste manual del importe de viaje por fin se guarda (existía en la UI, se calculaba… y se perdía al recargar), coordenadas de domicilio persistidas e índice único anti propuestas duplicadas. Todo con sondas de columna: el código funciona igual antes y después de aplicarla.
- Fijar días de alojamiento a mano ahora paga el alojamiento (antes: días=2, importe=0 €, explicación=ninguna).
- De 356 a ~400 tests, incluyendo por primera vez el baremo completo de tarifas y la frontera exacta de los 150 km. El dinero, testeado.

_La app ahora sabe qué día es en España. Hemos tocado techo._ 🇪🇸

---

## 🧠 **AEP Tarima v2.0** — _«Adiós, IA; hola, saber local»_ (2026-07-12 · PRs #64–#71)

El asistente con IA respondía bien, pero necesitaba red, una API key y fe. Lo jubilamos con honores.

**Lo grande:**
- **Centro de ayuda 100 % local** — buscador sobre ~35 temas curados, primeros pasos por rol y temas frecuentes. Cero red, cero IA, cero excusas. El conocimiento, en el navegador.
- **Retirada del asistente Gemini** — ruta, cliente, prompt y rate-limit eliminados. La base de conocimiento se queda; el intermediario, no.

**Seguridad:**
- Políticas RLS permisivas eliminadas — los datos sensibles solo se leen desde el servidor. Cerramos la puerta y también la gatera.
- Lote de hardening + correcciones con tests de regresión (#71).

**También:**
- El token de refresco caducado ya se trata como «sesión expirada» y no como «incendio en el middleware» (#69).
- Vista previa del cuadrante inmune a cabeceras de framing (#68) e impresión sin el encabezado del navegador (#66).
- La pestaña dice «AEP Tarima». Antes decía más cosas. Menos es más.

_Nuestro asistente ya no alucina. Porque ya no hay asistente._ 🧘

---

## ⚡ **AEP Tarima v1.9+** — _«La ola de rendimiento»_ (2026-07-06 · PRs #54–#62)

Nueve PRs en un día. La app estaba bien, pero queríamos que volara.

- **Disponibilidad instantánea en tarima** — marcar un juez disponible ya no recarga medio universo (#54).
- **Dedupe y paralelización** en las rutas calientes del servidor; memoización y code-splitting en el cliente (#55–#58). Los diálogos pesados ya no viajan en el bundle inicial.
- **Multiaño de verdad** — temporada = año natural, con selector de año en la analítica (#60). El pasado por fin tiene su sitio.
- **Navegación agrupada en 5 dominios** (#61) y último inicio de sesión visible en administración (#62).

_El servidor hace menos consultas que un becario con miedo a preguntar._ 🏎️

---

## 🛡️ **AEP Tarima v1.9** — _«Censo anual y manos en la masa»_ (2026-07-05 · PRs #46–#53)

Primera gran auditoría externa. Sobrevivimos, y de paso el censo aprendió qué año es.

- **Arbitrajes por año natural** — parser de todas las hojas `ArbitrajesAAAA`, ficha con selector de año e «Histórico», filtro anual en el directorio (#51).
- **Lote 1 de auditoría** — RBAC, integridad del acta, PII, compensación y cuadrantes (#46). Los permisos ahora permiten lo que deben. Solo eso.
- **Recibo configurable** — organizador con 3 opciones (club / AEP / personalizable) y PDF con logo (#47, #48).
- **Reemplazo seguro del censo** — reimportar el Excel maestro ya no se lleva por delante campeonatos ni cuadrantes (#49).
- **Selección rápida subordinada a la disponibilidad** — la app ya no te sugiere jueces que dijeron que no podían (#50, #52).
- RLS endurecido (migración 033). Las políticas permisivas pasaron a mejor vida.

_El censo ya sabe en qué año vive. Nosotros, a ratos._ 📅

---

## 📡 **AEP Tarima v1.8** — _«En producción, y en tiempo real»_ (2026-06-28)

El gran salto: de «funciona en mi máquina» a «funciona en la de todos».

- **Producción en Vercel** — [aep-tarima.vercel.app](https://aep-tarima.vercel.app/), deploy automático desde `main`.
- **Tiempo real con Supabase Realtime** — lo que cambia un delegado lo ve el comité sin pulsar F5 (migración 029). F5 sigue funcionando, por nostalgia.
- **Rendimiento** — consultas batch, `React.cache`, contadores de navegación baratos, caché con TTL para zonas y normativa, índices (migración 030).
- Botón para eliminar la ubicación del domicilio. Por si te mudas. O por si nunca viviste ahí.

_331 tests en verde y una URL de verdad. Somos mayores._ 🌐

---

## 📚 **AEP Tarima v1.7** — _«Normativa para todos»_ (2026-06-28)

La normativa dejó de vivir en un PDF que nadie encontraba.

- **Sección de normativa unificada** — 4 pestañas: Guía AEP, plazas de tarima, IPF y compensación.
- **Recibo PDF clavado a la plantilla oficial AEP** — IBAN legible, descarga en móvil, sin popup de compartir. La contabilidad, por fin, imprimible.
- **Autocomplete de domicilio** con OpenStreetMap vía API propia del servidor.
- Badges de nivel compactos en tarima (R, N, I, II) — porque el espacio en un cuadrante es oro.
- Branding en los correos de Supabase (migración 028). Hasta los emails van de uniforme.

_El PDF del recibo es idéntico al oficial. El delegado financiero lloró (de alegría)._ 🧾

---

## 💶 **AEP Tarima v1.6** — _«El Hub de Compensación»_ (2026-06)

El dinero de todos los campeonatos, en una sola pantalla. Se acabó abrir 14 pestañas.

- **Panel `/compensation`** — vista global del estado de compensación de todos los campeonatos, con su API de hub.
- **Km manual, vehículo compartido y montaje de sistema** — cada modalidad con su casilla y su lógica.
- **~180 clubes AEP precargados** con soporte multi-club por campeonato (migraciones 026–027).

_Un hub para gobernarlos a todos._ 💍

---

## 🧮 **AEP Tarima v1.5** — _«Que no falte ni un céntimo»_ (2026-06)

La compensación de jueces pasó de hoja de cálculo compartida a sistema de verdad.

- **Compensación end-to-end** — dietas por sesión y función, kilometraje, pernocta, todo calculado desde la tarima real (migraciones 023–025).
- **IBAN efímero** — se usa para el recibo y no se queda a vivir en la base de datos.
- **Nuevo rol `responsable_financiero_jueces`** — alguien tiene que firmar.
- UI de tarima más densa: más información, mismos píxeles.

_El Excel de compensaciones ha sido jubilado con todos los honores._ 🪦

---

## 🔒 **AEP Tarima v1.4** — _«Endurecimiento general»_ (2026-06)

La versión en la que dejamos de confiar en que todo el mundo haría lo correcto.

- **Roster serio** — plazas requeridas por campeonato, detección de conflictos, flujo de imprevistos con desbloqueo y re-aprobación.
- **Privacidad zonal** — cada delegado ve su zona y solo su zona. Las demás no existen (para él).
- **Login server-side** y **multi-temporada** (`season.ts`).

(De la v1.3 no hay registros. Los historiadores discrepan.)

_La app ahora desconfía profesionalmente. Como un buen juez central._ 🕵️

---

## 🧪 **AEP Tarima v1.2** — _«Calidad y limpieza»_ (2025-05)

- **Edición de campeonatos** completa.
- **Corrección de tests** — los que pasaban por casualidad ahora pasan por convicción.
- **Refactor de los archivos de +500 líneas** — divididos con cariño y sin anestesia.

_Menos líneas por archivo, más años de vida por desarrollador._ ✂️

---

## 🧩 **AEP Tarima v1.1** — _«Completar el flujo»_ (2025-05)

- **Asignación cross-zona** con motivo — pedir un juez prestado a otra zona, con papeleo incluido.
- **Editor de plantillas de tarima** e **importación de PDFs** (horarios y cuadrantes).
- **Disponibilidad por campeonato** — los jueces dicen si pueden ir ANTES de que los pongas en el cuadrante. Idea audaz.
- Cobertura en la analítica y mejoras de UI del roster.

_El flujo completo, del PDF al acta. Sin pasar por WhatsApp._ 📋

---

## 🌱 **AEP Tarima v1.0** — _«Génesis»_ (2025)

En el principio era el caos: Excels, PDFs y cadenas de emails. Y dijimos: hágase la plataforma.

- **La base de todo** — Next.js + Supabase, con los módulos fundacionales: campeonatos, censo de jueces, tarima con drag-and-drop, aprobaciones, exámenes y ascensos.
- **Roles y permisos** — super admin, delegado de jueces, delegados de zona, solo-lectura.
- **El cuadrante** — de arrastrar nombres en una pizarra a arrastrarlos en un navegador.

_Todo lo demás es historia. Literalmente: está aquí arriba._ 🏛️
