// v2 manager-JWT auth boundary. Re-exports the existing, already-live
// requireManager() rather than building a second identity resolver — see
// docs/API_V2.md architecture decision #1. This is the ONLY trust
// boundary that accepts a Supabase manager JWT; it must never be used to
// authenticate a Display, a Stripe webhook, or a scheduler/worker
// callback (INV-2 in the migration plan — those keep their own separate
// _shared helpers and are never routed through this one).

export { requireManager, type ManagerAuthContext } from "../managerAuth.ts";
