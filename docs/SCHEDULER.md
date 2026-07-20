# Automation scheduler

`automations-run` (`supabase/functions/automations-run/index.ts`) exists
but nothing calls it on its own — this document is the deployment-ready
configuration for the chosen option (#3 from the task brief: a minimal
external scheduled request, shared-secret authenticated). Options #1
(`pg_cron`) and #2 (a KpnCompute-side scheduler) were not chosen: #1
requires enabling the `pg_cron` extension, a schema change outside this
run's approval boundary; #2 would require access to and changes in the
KpnCompute repository, which is out of scope here and not something this
session has visibility into.

## Invocation frequency

**Every 60 seconds.** Automations are minute-granularity by design (cron
expressions here are 5-field, no seconds field — see
`supabase/functions/_shared/cron.ts`), so polling faster buys nothing.
Slower than 60s pushes real automations' effective execution time later
than their `next_run_at`; that's a monitoring signal (§ health check),
not a correctness problem — a late-but-single execution is still correct
because of the claim mechanism below.

## Authentication

`X-Scena-Callback-Secret: <SCENA_AUTOMATIONS_RUN_SECRET>` header, checked
with a constant-time comparison (`_shared/crypto.ts#timingSafeEqual`).
Same pattern as `presentation-callback`. The secret must be provisioned
as a Supabase Edge Function secret (`supabase secrets set
SCENA_AUTOMATIONS_RUN_SECRET=<value>`) and given to whatever scheduler
calls this endpoint — never embedded in a manager-facing client.

## Timeout behavior

Each invocation processes at most `BATCH_SIZE = 20` due automations
(`automations-run/index.ts`), each doing a handful of small, indexed
writes (`display_automations_due_idx` on `(is_enabled, next_run_at)`
makes the due-lookup itself O(log n)). This keeps a single invocation
well under Supabase Edge Functions' execution limit regardless of
scheduler timeout settings. If backlog regularly exceeds 20 due
automations per minute, that's a capacity signal — raise the invocation
frequency before raising `BATCH_SIZE`.

## Idempotency & overlapping-run handling

Verified against the live database in a rolled-back transaction (not
simulated): two concurrent `UPDATE ... SET next_run_at = null WHERE id =
X AND is_enabled AND next_run_at <= now()` statements against the same
due automation resolve to exactly one winner — the second returns zero
rows. `automations-run` uses exactly this pattern to claim a row before
executing it, so overlapping scheduler invocations (a slow run still in
flight when the next tick fires) can never double-execute the same
automation. `automations-run`'s own response distinguishes
`"skipped_raced"` from `"executed"` so this is directly observable per
invocation.

## Retry behavior

- **Cron automations**: on both success and failure, `next_run_at`
  advances to the next matching occurrence (`nextCronOccurrence`) — a
  failure doesn't stop future scheduled runs.
- **One-shot (`schedule_type='once'`) automations**: on success,
  `is_enabled` is set to `false` (they can't recur). On failure, instead
  of being left stuck (`next_run_at=null` never again satisfies `<=
  now()`), they're rescheduled 5 minutes out and retried indefinitely
  until a manager disables them or the underlying problem (e.g. a
  deleted target layout) is fixed. This is a real gap closed during this
  pass — the previous version silently stranded failed one-shot
  automations with no way to notice. See `docs/DATABASE_SCHEMA.md` §5b:
  the proposed `failure_count` column is what would let this circuit-
  break automatically instead of retrying forever; without it, "retry
  every 5 minutes forever" is the safer failure mode of the two
  available without a schema change.

## Failed-run observability

Today: `last_run_at` advances on every attempt (success or failure);
`automations-run`'s JSON response lists each processed automation's
outcome (`executed` / `skipped_raced` / `failed`) and, on failure, the
error message — visible in whatever logs the scheduler captures from the
HTTP response, and in Supabase's own Edge Function logs
(`console.error` per failure). There is no queryable "automations
currently failing" view until the §5b migration is applied.

## Exact setup — external scheduler (GitHub Actions example)

Any scheduler that can make an authenticated HTTPS POST once a minute
works. A repository-hosted GitHub Actions cron avoids introducing new
infrastructure:

```yaml
# .github/workflows/automations-run.yml
name: Run Scena display automations
on:
  schedule:
    - cron: "* * * * *"   # every minute
  workflow_dispatch: {}     # manual trigger for the health check below
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke automations-run
        run: |
          curl -sf -X POST "${SUPABASE_URL}/functions/v1/automations-run" \
            -H "x-scena-callback-secret: ${SCENA_AUTOMATIONS_RUN_SECRET}" \
            -H "content-type: application/json" \
            --max-time 30 \
            -d '{}'
        env:
          SUPABASE_URL: ${{ secrets.SCENA_SUPABASE_URL }}
          SCENA_AUTOMATIONS_RUN_SECRET: ${{ secrets.SCENA_AUTOMATIONS_RUN_SECRET }}
```

(GitHub Actions' cron scheduling is best-effort and can drift several
minutes under platform load — acceptable here since the claim mechanism
makes late-and-single execution safe, but note it if automations need
tighter timing than that.)

## Health-check procedure

1. `curl -X POST "$SUPABASE_URL/functions/v1/automations-run" -H "x-scena-callback-secret: $SECRET" -d '{}'` manually — expect `200` with `{ processed, results: [] }` when nothing is due, or a populated `results` array otherwise.
2. Query (via the Supabase SQL editor or MCP) `select id, name, last_run_at, next_run_at, is_enabled from public.display_automations where is_enabled order by next_run_at nulls last;` — every enabled automation's `last_run_at` should be within one invocation interval of `next_run_at` having passed.
3. Missing secret / wrong secret → `401 UNAUTHENTICATED`. Confirms the scheduler's credential is live and correctly rejected when wrong (fail-closed check).
4. If a specific automation never advances past a stale `next_run_at`, check the scheduler's own run history first (§ overlapping-run handling means it's never "stuck behind another run" — it's either not being invoked, or repeatedly failing, visible in `last_run_at` advancing with `next_run_at` staying suspiciously close to now()+5m).
