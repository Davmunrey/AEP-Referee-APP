-- Compensación de gastos de jueces (baremo AEP 31/10/2025)

ALTER TABLE referees
  ADD COLUMN IF NOT EXISTS domicilio TEXT,
  ADD COLUMN IF NOT EXISTS domicilio_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS domicilio_lng DOUBLE PRECISION;

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS sede_direccion TEXT,
  ADD COLUMN IF NOT EXISTS sede_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sede_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ambito TEXT CHECK (ambito IS NULL OR ambito IN ('epf', 'ipf'));

CREATE TABLE IF NOT EXISTS judge_compensation_claims (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  referee_id TEXT NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  referee_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador', 'enviado', 'aprobado', 'pagado', 'rechazado')),
  travel_mode TEXT NOT NULL DEFAULT 'km_rate'
    CHECK (travel_mode IN ('km_rate', 'fuel_receipt', 'transport_ticket', 'shared_vehicle_passenger', 'none')),
  distance_km_one_way NUMERIC,
  distance_km_round_trip NUMERIC,
  distance_source TEXT CHECK (distance_source IS NULL OR distance_source IN ('google_maps', 'manual')),
  travel_amount NUMERIC NOT NULL DEFAULT 0,
  travel_approved BOOLEAN NOT NULL DEFAULT false,
  travel_notes TEXT,
  is_competition_manager BOOLEAN NOT NULL DEFAULT false,
  competition_manager_per_day BOOLEAN NOT NULL DEFAULT false,
  lodging_days INTEGER NOT NULL DEFAULT 0,
  lodging_eligible BOOLEAN NOT NULL DEFAULT false,
  lodging_eligible_override BOOLEAN,
  lodging_days_override INTEGER,
  duties_amount NUMERIC NOT NULL DEFAULT 0,
  lodging_amount NUMERIC NOT NULL DEFAULT 0,
  competition_manager_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  pesaje_count INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competition_id, referee_id)
);

CREATE INDEX IF NOT EXISTS judge_compensation_claims_competition_idx
  ON judge_compensation_claims(competition_id);

CREATE INDEX IF NOT EXISTS judge_compensation_claims_referee_idx
  ON judge_compensation_claims(referee_id);

CREATE TABLE IF NOT EXISTS judge_compensation_duty_lines (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES judge_compensation_claims(id) ON DELETE CASCADE,
  duty_type TEXT NOT NULL CHECK (duty_type IN ('session', 'pesaje')),
  session_label TEXT NOT NULL,
  unit_amount NUMERIC,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL,
  slot_keys TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS judge_compensation_duty_lines_claim_idx
  ON judge_compensation_duty_lines(claim_id);

ALTER TABLE judge_compensation_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_compensation_duty_lines ENABLE ROW LEVEL SECURITY;
