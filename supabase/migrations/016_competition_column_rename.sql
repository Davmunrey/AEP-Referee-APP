ALTER TABLE approval_proposals
  RENAME COLUMN event_id TO competition_id;

ALTER TABLE approval_proposals
  RENAME COLUMN event_name TO competition_name;

ALTER TABLE roster_history
  RENAME COLUMN event_id TO competition_id;

DROP INDEX IF EXISTS approval_proposals_status_idx;
CREATE INDEX IF NOT EXISTS approval_proposals_status_idx ON approval_proposals(status);
CREATE INDEX IF NOT EXISTS approval_proposals_competition_id_idx
  ON approval_proposals(competition_id);
CREATE INDEX IF NOT EXISTS roster_history_competition_id_idx
  ON roster_history(competition_id);
