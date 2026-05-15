-- AEP Tarima — esquema producción (Supabase Postgres + Auth)
-- Ejecutar en Supabase SQL Editor o: supabase db push

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('nacional', 'regional', 'lectura');
CREATE TYPE approval_status AS ENUM ('pendiente', 'aprobado', 'rechazado');
CREATE TYPE referee_status AS ENUM ('Activo', 'Inactivo', 'Sancionado');
CREATE TYPE event_status AS ENUM ('Completo', 'Incompleto', 'Crítico', 'Borrador');
CREATE TYPE event_type AS ENUM ('AEP-1', 'AEP-2', 'AEP-3');
CREATE TYPE activity_type AS ENUM ('propuesta', 'aprobacion', 'rechazo', 'cambio', 'ascenso');

-- Zonas federativas
CREATE TABLE zones (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Perfiles de usuario (1:1 con auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  rol_label TEXT NOT NULL,
  iniciales TEXT NOT NULL,
  role user_role NOT NULL,
  zona TEXT REFERENCES zones(code),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX profiles_role_idx ON profiles(role);
CREATE INDEX profiles_zona_idx ON profiles(zona);

-- Árbitros
CREATE TABLE referees (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  zona TEXT NOT NULL REFERENCES zones(code),
  nivel TEXT NOT NULL,
  estado referee_status NOT NULL DEFAULT 'Activo',
  eventos INTEGER NOT NULL DEFAULT 0,
  ultimo TEXT NOT NULL DEFAULT '—',
  disp BOOLEAN NOT NULL DEFAULT true,
  iniciales TEXT NOT NULL,
  email TEXT,
  licencia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX referees_zona_idx ON referees(zona);

-- Campeonatos
CREATE TABLE competitions (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo event_type NOT NULL,
  fecha DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  sede TEXT NOT NULL,
  sesiones INTEGER NOT NULL DEFAULT 3,
  requeridos INTEGER NOT NULL DEFAULT 9,
  confirmados INTEGER NOT NULL DEFAULT 0,
  estado event_status NOT NULL DEFAULT 'Borrador',
  aprobacion TEXT NOT NULL DEFAULT 'Sin propuesta',
  zona TEXT REFERENCES zones(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX competitions_zona_idx ON competitions(zona);

-- Asignaciones de tarima
CREATE TABLE roster_assignments (
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  slot_key TEXT NOT NULL,
  referee_id TEXT NOT NULL REFERENCES referees(id),
  PRIMARY KEY (competition_id, slot_key)
);

-- Propuestas de aprobación
CREATE TABLE approval_proposals (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  zona TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status approval_status NOT NULL DEFAULT 'pendiente',
  assignments JSONB NOT NULL DEFAULT '{}',
  comment TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX approval_proposals_status_idx ON approval_proposals(status);

-- Ascensos
CREATE TABLE promotion_requests (
  id TEXT PRIMARY KEY,
  referee_id TEXT NOT NULL REFERENCES referees(id),
  referee_name TEXT NOT NULL,
  from_level TEXT NOT NULL,
  to_level TEXT NOT NULL,
  zona TEXT NOT NULL,
  status approval_status NOT NULL DEFAULT 'pendiente',
  submitted_at TEXT NOT NULL,
  eventos_completados INTEGER NOT NULL DEFAULT 0,
  motivo TEXT
);

-- Actividad reciente
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo activity_type NOT NULL,
  actor TEXT NOT NULL,
  accion TEXT NOT NULL,
  evento TEXT NOT NULL,
  hace TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial de tarima
CREATE TABLE roster_history (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT
);

-- Normativa
CREATE TABLE regulation_rules (
  id TEXT PRIMARY KEY,
  rol TEXT NOT NULL,
  role_key TEXT NOT NULL,
  min_level TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

-- Config global (plantilla roster, calendario JSON)
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referees ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Helper: perfil del usuario autenticado
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM profiles WHERE id = auth.uid() AND activo = true;
$$;

-- Profiles: leer el propio; nacional lee todos
CREATE POLICY profiles_select_own ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (SELECT role FROM public.current_profile()) = 'nacional');

CREATE POLICY profiles_update_nacional ON profiles FOR ALL TO authenticated
  USING ((SELECT role FROM public.current_profile()) = 'nacional')
  WITH CHECK ((SELECT role FROM public.current_profile()) = 'nacional');

-- Zones: lectura autenticados
CREATE POLICY zones_select ON zones FOR SELECT TO authenticated USING (true);

-- Referees: nacional todo; regional su zona; lectura su zona
CREATE POLICY referees_select ON referees FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.current_profile()) = 'nacional'
    OR zona = (SELECT zona FROM public.current_profile())
    OR (SELECT role FROM public.current_profile()) = 'lectura'
  );

CREATE POLICY referees_write ON referees FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.current_profile()) IN ('nacional', 'regional')
    AND (
      (SELECT role FROM public.current_profile()) = 'nacional'
      OR zona = (SELECT zona FROM public.current_profile())
    )
  )
  WITH CHECK (
    (SELECT role FROM public.current_profile()) IN ('nacional', 'regional')
    AND (
      (SELECT role FROM public.current_profile()) = 'nacional'
      OR zona = (SELECT zona FROM public.current_profile())
    )
  );

-- Competitions
CREATE POLICY competitions_select ON competitions FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.current_profile()) = 'nacional'
    OR zona = (SELECT zona FROM public.current_profile())
    OR (SELECT role FROM public.current_profile()) = 'lectura'
  );

CREATE POLICY competitions_write ON competitions FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.current_profile()) IN ('nacional', 'regional')
    AND (
      (SELECT role FROM public.current_profile()) = 'nacional'
      OR zona = (SELECT zona FROM public.current_profile())
    )
  )
  WITH CHECK (
    (SELECT role FROM public.current_profile()) IN ('nacional', 'regional')
    AND (
      (SELECT role FROM public.current_profile()) = 'nacional'
      OR zona = (SELECT zona FROM public.current_profile())
    )
  );

-- Roster assignments (misma lógica por competición)
CREATE POLICY roster_assignments_access ON roster_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM competitions c
      WHERE c.id = competition_id
      AND (
        (SELECT role FROM public.current_profile()) = 'nacional'
        OR c.zona = (SELECT zona FROM public.current_profile())
      )
    )
  );

-- Approvals
CREATE POLICY approvals_select ON approval_proposals FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.current_profile()) = 'nacional'
    OR zona = (SELECT zona FROM public.current_profile())
  );

CREATE POLICY approvals_write ON approval_proposals FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.current_profile()) IN ('nacional', 'regional')
  );

-- Promotions
CREATE POLICY promotions_select ON promotion_requests FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.current_profile()) = 'nacional'
    OR zona = (SELECT zona FROM public.current_profile())
  );

CREATE POLICY promotions_write ON promotion_requests FOR ALL TO authenticated
  USING ((SELECT role FROM public.current_profile()) IN ('nacional', 'regional'));

-- Activity, history, regulations, config: lectura todos; escritura nacional/regional
CREATE POLICY activity_select ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY activity_insert ON activity_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY history_access ON roster_history FOR ALL TO authenticated USING (true);

CREATE POLICY regulations_select ON regulation_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY app_config_select ON app_config FOR SELECT TO authenticated USING (true);
