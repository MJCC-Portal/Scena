-- Drop the unused mjcc_identities table (0002) that was never wired to the
-- Edge Function. external_identities (0003) is the canonical identity table.
-- Apply through the authorized Supabase MCP session after review.

DROP TABLE IF EXISTS public.mjcc_identities CASCADE;
DROP FUNCTION IF EXISTS public.forbid_mjcc_identity_relink() CASCADE;
