-- 035_support_tickets.sql
-- Zona de tickets de soporte interno con comentarios y adjuntos.
-- Tres tablas nuevas + un bucket de storage privado para los ficheros.
--
-- La aplica el workflow «Migraciones Supabase» al llegar a main; también puede
-- pegarse a mano en el editor SQL de Supabase, porque es idempotente.
-- Todo es idempotente (IF NOT EXISTS / ON CONFLICT): re-ejecutarla no rompe nada.
--
-- RLS: se habilita en las tres tablas SIN políticas permisivas (patrón post-033).
-- Toda la app accede a estas tablas SOLO desde el servidor con `service_role`
-- (que ignora RLS), así que sin políticas quedan bloqueadas a la clave anónima
-- pública, igual que referee_sanctions / competition_availability tras 033.

-- ── Tickets ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'abierto',
  created_by_id TEXT,
  created_by_name TEXT NOT NULL,
  created_by_role TEXT,
  zona TEXT,
  resolution_note TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status);
CREATE INDEX IF NOT EXISTS support_tickets_created_by_idx ON support_tickets (created_by_id);

-- ── Comentarios ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_ticket_comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id TEXT,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_ticket_comments_ticket_idx ON support_ticket_comments (ticket_id);

-- ── Adjuntos ────────────────────────────────────────────────────────────────
-- comment_id NULL = adjunto del ticket; si no, adjunto de ese comentario.
CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES support_ticket_comments(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_ticket_attachments_ticket_idx ON support_ticket_attachments (ticket_id);

-- ── RLS (sin políticas: solo servidor con service_role) ─────────────────────
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- ── Bucket de storage privado para los adjuntos ─────────────────────────────
-- Privado (public = false): los ficheros solo se sirven vía URL firmada de corta
-- duración generada en el servidor al leer un ticket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;
