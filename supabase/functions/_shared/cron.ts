// Minimal 5-field cron next-occurrence calculator (minute hour dom month
// dow), evaluated in UTC. Supports '*', a single number, and comma lists
// (e.g. "0,30"); step syntax ("*/15") and named months/days are not
// supported. This is intentionally small — swap for a proper library if
// finer cron semantics or full IANA timezone correctness are needed.
// The `timezone` an automation stores today is carried through the API
// but NOT applied here; see docs/DATABASE_SCHEMA.md for the tracked gap.

function parseField(field: string, min: number, max: number): Set<number> {
  if (field === "*") return new Set(Array.from({ length: max - min + 1 }, (_, i) => min + i));
  return new Set(field.split(",").map((s) => {
    const n = Number(s);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`invalid cron field value: ${s}`);
    return n;
  }));
}

export function nextCronOccurrence(cronExpression: string, after: Date): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("cron_expression must have 5 fields: minute hour dom month dow");
  const [minuteF, hourF, domF, monthF, dowF] = parts;
  const minutes = parseField(minuteF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const months = parseField(monthF, 1, 12);
  const dows = parseField(dowF, 0, 6);

  const candidate = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), after.getUTCHours(), after.getUTCMinutes() + 1, 0, 0));
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (
      minutes.has(candidate.getUTCMinutes()) &&
      hours.has(candidate.getUTCHours()) &&
      doms.has(candidate.getUTCDate()) &&
      months.has(candidate.getUTCMonth() + 1) &&
      dows.has(candidate.getUTCDay())
    ) {
      return candidate;
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error("could not find a matching cron occurrence within one year");
}
