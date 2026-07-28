# Auditoría de la base de datos

Julio 2026. Alcance: el esquema completo de Supabase reconstruido migración a
migración (001–035), contrastado contra todas las consultas que hace la app.

Siete frentes en paralelo —seguridad y RLS, índices frente a las consultas
reales, integridad referencial, tipos y dinero, deriva entre código y esquema,
funciones y triggers, y crecimiento a largo plazo— y **cada hallazgo pasado
después por un revisor con el encargo explícito de refutarlo** leyendo los
ficheros. De 78 hallazgos en bruto, 69 sobrevivieron a esa criba; 9 se
descartaron por no sostenerse y a otros muchos se les bajó la gravedad.

## Veredicto

La base está **sana en lo esencial**: el modelo de datos es coherente, la RLS
está activada en todas las tablas y el acceso va siempre por el servidor con
`service_role`. No hay ninguna vía por la que un anónimo de Internet lea datos.

Dicho eso, aparecieron **dos defectos graves y reales**, ambos ya corregidos:
uno destruía dinero liquidado y el otro corrompía en silencio lo que se ve en
pantalla. Ninguno de los dos era visible desde la app: ese es justamente el tipo
de fallo que una auditoría tiene que encontrar.

## Lo que se ha arreglado

**Borrar un campeonato destruía sus liquidaciones de dietas.** La clave ajena
nació con `ON DELETE CASCADE`, así que eliminar un campeonato se llevaba por
delante todas sus liquidaciones, incluidas las que ya estaban en «pagado», y sin
dejar rastro. Y no hacía falta que nadie pulsara «Eliminar»: la importación de
calendario deduplica sola, y el criterio que decide qué copia conservar solo
mira la tarima, no el dinero — podía borrar justo la que tenía las liquidaciones.
Corregido en los dos planos: el código se niega y responde con un mensaje claro,
y la migración 036 pone `ON DELETE RESTRICT` más un trigger que impide borrar
cualquier liquidación aprobada o pagada por cualquier vía.

**A partir de unos 20–35 campeonatos, la app empezaba a mentir.** Las
asignaciones de tarima se leían sin paginar, y PostgREST recorta toda respuesta
a 1000 filas sin error y sin ninguna señal. Los campeonatos que caían fuera del
corte se pintaban como «Crítico / 0 confirmados» aunque tuvieran la tarima
llena, y su resumen de compensación salía vacío, de modo que liquidaciones ya
guardadas no llegaban al hub. Como no había orden explícito, además, los
afectados no eran «los últimos» sino un subconjunto arbitrario. Ahora pagina.

**La zona de Soporte no se refrescaba sola.** Las tres tablas de tickets se
crearon después del mecanismo de sincronización en vivo y se quedaron fuera: un
ticket o un comentario nuevo no llegaban a las demás pestañas abiertas hasta
recargar.

**El panel «Actividad reciente» escaneaba la tabla entera** en cada carga del
inicio: `activity_log` no tenía ni un índice.

**La tabla de cuarentena de la migración 034 nacía sin RLS**, lo que la habría
dejado abierta con la clave anónima pública pese a guardar propuestas de
aprobación completas.

## Lo que necesita que decidas tú

Ninguna es urgente, pero todas son reales y ninguna se puede resolver sin saber
qué quieres que haga el producto.

**Quién puede ver el expediente disciplinario.** Hoy cualquier usuario con
cuenta —incluidos los roles de solo lectura y el responsable financiero— puede
ver las sanciones de un juez, con su motivo, tanto por la API como en la ficha.
No es un guard olvidado: la UI está construida así a propósito. La pregunta es
si debe seguir siéndolo, porque son datos de un procedimiento sancionador.

**Reimportar el censo puede borrar historial.** Al «reemplazar censo», los
jueces que no estén en el fichero y no tengan tarima se borran, y con ellos sus
sanciones, exámenes, informes y liquidaciones. Hoy hay una protección
*accidental*: basta que uno solo de ellos tenga una solicitud de ascenso para
que Postgres aborte el borrado completo. Conviene sustituir esa casualidad por
una decisión: o se protege el historial con `ON DELETE RESTRICT`, o el
importador deja de borrar y solo marca como inactivos.

**Las zonas viajan como texto libre.** Las columnas de zona de propuestas,
ascensos e informes no tienen clave ajena contra `zones`, y deciden quién ve
qué. Además, las de propuestas y ascensos nunca se remapearon a las cinco
macrozonas actuales.

**Un campeonato sin zona es invisible** para el delegado de esa zona, porque la
columna admite nulos.

**Un juez puede acumular varias solicitudes de ascenso pendientes.** La
restricción de «una sola pendiente» existe para campeonatos pero no para
ascensos.

**Nada garantiza que el estado sancionador de un juez esté al día.** Se deriva
de las sanciones desde el código; si un proceso falla a medias, la ficha queda
desincronizada y nada lo detecta.

**Crecimiento.** El hub de compensación y la analítica leen todo el histórico
sin acotar por temporada. Funciona hoy; conviene decidir el corte antes de que
duela.

## Descartado tras verificarlo

Merece la pena decir qué **no** es un problema, porque también da confianza.

Se descartó que un usuario pudiera escalar a administrador desde la consola del
navegador: aunque los privilegios por defecto de Supabase siguen concedidos, la
tabla de perfiles tiene RLS y su única política es de lectura, así que la
escritura está denegada. Se descartó también que las matemáticas de compensación
estuvieran mal —se verificaron y son correctas—, y se rebajaron varios hallazgos
cuyo impacto estaba inflado, entre ellos el de la precisión de las columnas
monetarias.

La reconstrucción del esquema dejó además tres cosas útiles sobre el historial:
la migración 009 referencia una tabla que no existe en ninguna migración, la 018
declaraba una clave ajena con tipos incompatibles y probablemente nunca llegó a
aplicarse, y los renombrados de la 016 son no-ops porque las columnas ya nacen
con el nombre de destino. Ninguna afecta al estado actual, pero explican por qué
el historial real de producción puede no coincidir del todo con estos ficheros.
