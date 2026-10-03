# Changelog — AEP Tarima

Historial de versiones desplegadas en producción (`main` → [aep-tarima.vercel.app](https://aep-tarima.vercel.app/)).

---

## 🎨 **AEP Tarima v2.5** — _«Cara nueva»_ (2026-10-03)

La app funcionaba muy bien y parecía de 2019. Ya no.

- **Tipografía Geist** en lugar de DM Sans, y adiós a la monoespaciada de aire «terminal» en fechas y contadores: las cifras siguen alineadas en columna, pero con la misma letra que el resto.
- **Paleta neutra y limpia**: fuera el beige; marco gris, lienzo de página con borde fino y tarjetas blancas encima.
- **Sin MAYÚSCULAS GRITONAS**: más de cincuenta rótulos (cabeceras de tabla, menú, formularios, tarima) pasan a minúscula de frase.
- **Menú lateral compacto**: ítems más bajos (ahora cabe entero en un portátil) y el activo es una tarjeta blanca con el icono en rojo.
- **KPIs sobrios**: cifra en el color del texto, un punto de color junto al rótulo y nada de franjas ni halos.
- Botones e insignias sin halos ni bordes de color, «Montar tarima» como botón secundario en las tarjetas, ayuda flotante discreta y zonas con su nombre («Noroeste», no «NOROESTE»).

---

## ✨ **AEP Tarima v2.4** — _«Producto pulido»_ (2026-10-03 · PRs #181–#188)

Auditoría pantalla a pantalla, en escritorio y en el móvil, como la usaría un delegado con prisa. Menos sustos, menos espacio perdido y ni un número inventado.

**Flujos que ahora llevan de la mano:**
- **Una tarima recién creada arranca donde toca.** Antes la app creía que había 12 huecos (el «requeridos» por defecto) y saltaba a «Asignación» con «Plantilla» marcada en verde y sin plantilla. Ahora arranca en «Plantilla», con «Importar horario» y «Crear plantilla manual» a la vista.
- **«Enviar a aprobación» ya no deja enviar una tarima vacía**: se desactiva y explica por qué (sin plantilla o sin jueces), en lugar de fallar después en el servidor.
- **El panel de jueces explica lo que esconde**: dice cuántos jueces no disponibles o de baja quedan fuera y ofrece «Quitar filtros» cuando la lista se queda vacía. Antes, un juez marcado «no disponible» desaparecía sin dar pistas.
- **La ficha del juez avisa** con un «No disponible» de que no aparecerá al montar tarimas.

**El dinero, quieto:**
- **Una liquidación pagada ya no se puede tocar**: ni el importe, ni los km, ni al recalcular, ni al calcular distancias en bloque (`423 Locked`). En pantalla se ve con un distintivo «pagada» y la fila deja de ser editable.

**Datos que ya no mienten:**
- Rechazar una propuesta o un ascenso exige motivo, y `approve: "false"` (texto) ya no cuenta como aprobación.
- Fechas que no existen (`2026-02-30`) y niveles que no existen se rechazan con un 400 que dice qué pasa.
- Los KPIs del dashboard ya no cuentan campeonatos celebrados como «próximos», la tasa de aprobación sin exámenes es «—» (no 0 %) y desaparecieron las mini-gráficas, que eran barras decorativas con pinta de serie temporal.
- El desplegable de campeonatos y el alta de campeonatos paginan: a partir de 1000 filas ya no se pierde nada.
- Las zonas se guardan siempre en su forma canónica («Centro», «MAD» y «2- CENTRO» son la misma).

**Móvil y orden:**
- **Navegación móvil de verdad**: cajón con todo el menú y el buscador, que se cierra solo al navegar.
- Menú en cinco grupos (General, Competiciones, Jueces, Referencia, Administración), y el rótulo de cada página dice en cuál estás.
- Una sola pieza para las tiras de cifras (`MetricTile`), plurales bien hechos («1 juez», no «1 jueces») y vocabulario de la casa: tarima y hueco, no roster ni slot.
- Fuera los títulos repetidos tres veces (miga, barra superior y página) y la cabecera doble de la ficha de juez.
- En compensación, la tarjeta del organizador se pliega cuando ya está guardada: en el móvil la tabla de liquidaciones vuelve a verse en la primera pantalla.

**Rendimiento:**
- **80 kB menos en cada página**: Sentry solo se descarga si hay DSN configurado (de 185 kB a 105 kB de JS compartido).
- Migración 039: índices en las claves ajenas que no tenían ninguno.
- Recalcular compensación en paralelo (6 a la vez) y contadores del menú sin descargar el calendario entero.

**Accesibilidad:** todas las etiquetas de los formularios apuntan a su campo, el selector de nivel de un ascenso se anuncia como grupo con botón pulsado, y un id aleatorio que rompía la hidratación en compensación cambió por uno estable.

_1233 tests, todas las rutas recorridas a 375 px sin un solo desborde._ 📱

---

## 🔇 **AEP Tarima v2.3** — _«Cero silencios»_ (2026-09-02 → 2026-09-10 · PRs #76–#180)

Más de cien PRs con un único enemigo: el fallo que no avisa. `supabase-js` no lanza excepciones; devuelve `{ data: null, error }`. Y `null` se parece muchísimo a «no hay nada».

**Lecturas que fallaban en silencio:**
- Un corte de red podía vaciar el censo, **levantar la sanción de un juez**, dejar un hilo de soporte sin respuestas o imprimir un cuadrante sin jueces. Ahora una lectura fallida es un error con nombre y apellidos, nunca una lista vacía.
- Diecinueve rutas dejaban escapar la excepción y el cliente veía «Server error (500)». Ahora todas hablan el mismo idioma de errores, en español, y sin enseñar mensajes de Postgres al navegador.

**El corte de las 1000 filas:**
- PostgREST recorta cualquier respuesta a 1000 filas sin decir nada. Las asignaciones, las listas que solo crecen y los máximos para calcular ids van paginados, con un orden total (fecha + id) para no duplicar ni perder filas entre páginas.

**El dinero:**
- **Pagar una liquidación congela el puesto del juez** en la tarima: no se le puede sustituir, liberar, vaciar ni pisar al importar un cuadrante o cambiar la plantilla.
- Recalcular ya no borra la liquidación pagada del sustituido, borrar un juez o un campeonato ya no arrastra sus liquidaciones y reemplazar el censo no se lleva nada pagado.
- Dos personas editando la misma liquidación, el mismo hueco o la misma propuesta ya no se pisan: gana la primera y la segunda recibe un 409.

**Zonas, seguridad y permisos:**
- Un delegado sin zona (o con una zona ilegible) **ya no ve los datos de toda España**: los permisos zonales son *fail-closed* en listas, fichas, sanciones e historial.
- «Andalucía» y «Mediterráneo» con tilde se reconocen; los alias antiguos se canonicalizan antes de comparar.
- RLS cerrada en las cuatro tablas que seguían abiertas (037), alta de cuentas sin la bandera `invited` que escribía el propio usuario (038) y un test que impide crear tablas sin RLS.
- Un XSS almacenado en el enlace de un informe, cerrado. Gestionar cuentas ya no incluye, de propina, acceso al dinero.

**Fechas:**
- «Hoy» es el día español en todas partes: sanciones creadas de madrugada, campeonatos «finalizados», días hasta el campeonato y seis pantallas que pintaban la fecha con el huso del servidor.
- Calendarios con campeonatos que cruzan el año y filas con el mes en lugar del día se importan bien (antes: un campeonato de dos meses o con el fin once meses antes).

**Tarima y cuadrantes:**
- La tarima se congela mientras la propuesta espera aprobación, las sesiones con el mismo código ya no comparten huecos y el mismo campeonato ya no monta dos tarimas distintas según el botón.
- El cuadrante que la app imprime y el que sabe leer van en el mismo orden; el puesto repetido ya no sale dos veces en el acta.

**Migraciones:**
- El CI reproduce toda la cadena de migraciones sobre un Postgres limpio (y sobre la forma real de producción) en cada PR. La 034 y la 037 asumían un esquema que producción no tenía; ahora no pasa de la revisión.

_Si algo falla, ahora lo dice._ 📣

---

## 🚚 **AEP Tarima v2.2** — _«Migraciones que se aplican solas»_ (2026-07-28 → 2026-08-03 · PRs #73–#75)

- **Las migraciones se aplican solas** al llegar a `main`, con registro propio, modo «solo plan» y un portero que rechaza `DROP`, `TRUNCATE` y borrados sin `WHERE`.
- La migración 034 deja de destruir datos: las propuestas duplicadas se apartan a una tabla de cuarentena.
- Borrar un campeonato ya no destruye sus liquidaciones de dietas (036), y la app dejaba de mentir a partir de ~1000 asignaciones.
- CI en verde, 8 CVE de Next.js cerradas e informe completo de auditoría de la base de datos ([docs/AUDIT-DATABASE.md](docs/AUDIT-DATABASE.md)).
- El workflow diagnostica la cadena de conexión de Supabase antes de intentar migrar, y el log ya no termina con el error críptico que el diagnóstico acababa de explicar.

---

## 🔬 **AEP Tarima v2.1** — _«La Gran Auditoría»_ (2026-07-28 · PR #72)

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
- **Activar/desactivar jueces desde el directorio** — antes el estado solo se cambiaba entrando a editar la ficha; la única acción rápida era… eliminar. Ahora hay botón de alternar (el estado «Sancionado» sigue gobernado por el flujo de sanciones).
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
