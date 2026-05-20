DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'approval_proposals'
      AND column_name = 'event_id'
  ) THEN
    ALTER TABLE approval_proposals RENAME COLUMN event_id TO competition_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'approval_proposals'
      AND column_name = 'event_name'
  ) THEN
    ALTER TABLE approval_proposals RENAME COLUMN event_name TO competition_name;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roster_history'
      AND column_name = 'event_id'
  ) THEN
    ALTER TABLE roster_history RENAME COLUMN event_id TO competition_id;
  END IF;
END $$;

DROP INDEX IF EXISTS approval_proposals_status_idx;
CREATE INDEX IF NOT EXISTS approval_proposals_status_idx ON approval_proposals(status);
CREATE INDEX IF NOT EXISTS approval_proposals_competition_id_idx
  ON approval_proposals(competition_id);
CREATE INDEX IF NOT EXISTS roster_history_competition_id_idx
  ON roster_history(competition_id);
