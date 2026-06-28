-- Comentario de revisión al aprobar/rechazar ascensos (paridad con approval_proposals.comment).
ALTER TABLE promotion_requests
  ADD COLUMN IF NOT EXISTS review_comment TEXT;
