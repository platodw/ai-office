-- Migration 009: add github_org to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS github_org text;
