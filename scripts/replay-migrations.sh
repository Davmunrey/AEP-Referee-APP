#!/usr/bin/env bash
#
# Reproduce supabase/migrations/*.sql de la 001 a la última sobre una base
# vacía, en orden y cada fichero en su propia transacción, igual que hace el
# workflow «Migraciones Supabase».
#
# Existe porque la primera ejecución real de ese workflow contra producción
# murió en la 034 con «column a.competition_id does not exist»: la migración
# razonaba sobre el repositorio en vez de sobre la base. Nada en CI miraba el
# SQL, así que el primer lector fue producción.
#
# Esto NO sustituye a probar contra producción —el esquema real arrastra
# historia que el repositorio ya no describe— pero caza lo que sí es
# comprobable sin una base real: SQL que no compila, referencias a tablas o
# columnas que ninguna migración anterior crea, tipos que no casan en una clave
# ajena y migraciones que no se pueden repetir.
#
# Uso:  scripts/replay-migrations.sh [URL_DE_CONEXION]
# Por defecto usa $DATABASE_URL, y si tampoco está, un Postgres local.
set -euo pipefail

PGURL="${1:-${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}}"
raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
andamio="$raiz/scripts/sql/andamio-supabase.sql"

# Base limpia por ejecución: reproducir sobre restos no demuestra nada. Se
# vacía la que indique la cadena en vez de crear otra, para no tener que
# reescribir la URL —que admite demasiadas formas— y para dejar claro que esta
# base es de usar y tirar. NUNCA la apuntes a producción.
destino="$PGURL"
fallos=0

vaciar() {
  psql "$destino" -X -q -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;
DROP SCHEMA IF EXISTS extensions CASCADE;
CREATE SCHEMA public;
DO $$ BEGIN
  EXECUTE 'DROP PUBLICATION IF EXISTS supabase_realtime';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
SQL
  # Supabase trae de fábrica los esquemas auth y storage, los roles de
  # PostgREST y la publicación de realtime. Un Postgres pelado no, y las
  # migraciones cuentan con ellos.
  psql "$destino" -X -q -v ON_ERROR_STOP=1 -f "$andamio"
}

# aplicar <fichero> [--callado]
aplicar() {
  local f="$1" nombre
  nombre="$(basename "$f")"
  if salida=$(psql "$destino" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$f" 2>&1); then
    [ "${2:-}" = "--callado" ] || echo "  ✓ $nombre"
    return 0
  fi
  echo "  ✗ $nombre"
  echo "$salida" | grep -E "ERROR|FATAL" | head -3 | sed 's/^/      /'
  fallos=$((fallos + 1))
  return 1
}

echo "── desde cero, todas en orden"
vaciar
total=0
for f in "$raiz"/supabase/migrations/*.sql; do
  total=$((total + 1))
  aplicar "$f" || true
done

# Repetirlas todas: el workflow no reejecuta las ya registradas, pero una
# migración que no aguanta una segunda pasada no se puede aplicar a mano en el
# editor SQL, que es como han llegado a producción casi todas.
#
# La 001 queda fuera: es el arranque del esquema, corre una vez sobre una base
# vacía y nadie la vuelve a pegar. Exigirle que se repita obligaría a envolver
# cada CREATE TABLE del fichero para comprobar algo que no ocurre.
echo "── segunda pasada"
for f in "$raiz"/supabase/migrations/*.sql; do
  case "$(basename "$f")" in 001_*) continue ;; esac
  aplicar "$f" --callado || true
done

# ── Sobre un esquema con la deriva de producción ────────────────────────────
# Lo de arriba solo demuestra que el SQL compila contra el esquema que sale de
# ESTE repositorio. No es donde se aplican las migraciones. La 034 pasaba esa
# prueba y murió contra producción, así que hace falta reproducir también sobre
# un esquema con las diferencias reales, que están documentadas en el fichero
# de deriva y confirmadas por ejecuciones del workflow.
echo "── con la deriva de producción"
vaciar
for f in "$raiz"/supabase/migrations/*.sql; do
  case "$(basename "$f")" in 03[4-9]_*|0[4-9][0-9]_*|[1-9][0-9][0-9]_*) continue ;; esac
  aplicar "$f" --callado || true
done
psql "$destino" -X -q -v ON_ERROR_STOP=1 -f "$raiz/scripts/sql/deriva-produccion.sql"
for f in "$raiz"/supabase/migrations/*.sql; do
  case "$(basename "$f")" in 03[4-9]_*|0[4-9][0-9]_*|[1-9][0-9][0-9]_*) ;; *) continue ;; esac
  aplicar "$f" || true
done

if [ "$fallos" -gt 0 ]; then
  echo "Reproducción de migraciones: FALLO ($fallos de $total)"
  exit 1
fi
echo "Reproducción de migraciones: OK ($total ficheros, desde cero, repetidas y con la deriva de producción)"
