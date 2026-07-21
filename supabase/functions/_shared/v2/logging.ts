// Structured logging for v2 requests. Deno Edge Function logs are plain
// stdout/stderr lines captured by Supabase — emitting JSON here makes
// them grep/parse-able without needing a log pipeline. Never log secrets
// (INV-6): callers pass only the fields they want recorded, and this
// module does not accept raw request/response bodies or headers.

export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  request_id: string;
  route?: string;
  user_id?: string;
  org_id?: string;
  status?: number;
  duration_ms?: number;
  [key: string]: unknown;
}

export function logEvent(level: LogLevel, message: string, fields: LogFields): void {
  const line = JSON.stringify({ level, message, ...fields, ts: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
