#!/usr/bin/env bash
#
# Aplica las migraciones de supabase/migrations/ que aún no estén aplicadas,
# en orden, cada una en su propia transacción, y las registra en
# public.applied_migrations. Ejecutable desde GitHub Actions o en local:
#
#   SUPABASE_DB_URL='postgresql://...' ./scripts/apply-migrations.sh
#
# SUPABASE_DB_URL debe ser la cadena del *Session pooler* (puerto 5432):
# la conexión directa db.<ref>.supabase.co solo tiene IPv6 y los runners de
# GitHub (y muchas redes locales) solo hablan IPv4.
#
# Historia previa: las migraciones hasta la 033 se aplicaron a mano en el
# SQL Editor, así que en la primera ejecución (tabla de registro vacía) se
# marcan como aplicadas sin ejecutarlas. Todo lo posterior a BASELINE se
# ejecuta de verdad.
set -euo pipefail

: "${SUPABASE_DB_URL:?Define SUPABASE_DB_URL con la cadena de conexión (Session pooler, puerto 5432)}"

BASELINE=033
DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"

q() { psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

q -c "CREATE TABLE IF NOT EXISTS public.applied_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )"

if [ "$(q -tAc 'SELECT count(*) FROM public.applied_migrations')" = "0" ]; then
  echo "Primera ejecución: marco como aplicadas las migraciones <= ${BASELINE} (aplicadas a mano)."
  for f in "$DIR"/*.sql; do
    v="$(basename "$f")"; v="${v%%_*}"
    if [ "$v" \< "$BASELINE" ] || [ "$v" = "$BASELINE" ]; then
      q -c "INSERT INTO public.applied_migrations(version) VALUES ('$v') ON CONFLICT DO NOTHING"
    fi
  done
fi

applied=0
for f in "$DIR"/*.sql; do
  v="$(basename "$f")"; v="${v%%_*}"
  if [ -n "$(q -tAc "SELECT 1 FROM public.applied_migrations WHERE version = '$v'")" ]; then
    continue
  fi
  echo "Aplicando $(basename "$f")…"
  # Una transacción por fichero: si algo falla, esa migración queda fuera
  # entera y sin registrar; el siguiente run la reintenta. Ojo: sentencias
  # como CREATE INDEX CONCURRENTLY no admiten transacción; no usarlas aquí.
  q --single-transaction -f "$f"
  q -c "INSERT INTO public.applied_migrations(version) VALUES ('$v')"
  applied=$((applied + 1))
done

if [ "$applied" = "0" ]; then
  echo "Base de datos al día: no hay migraciones pendientes."
else
  echo "Aplicadas $applied migraciones."
fi
