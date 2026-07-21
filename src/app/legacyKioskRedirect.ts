// Pure logic for main.tsx's pre-router compatibility bootstrap — kept
// separate from the DOM/history side effects so it's directly unit
// testable. Converts only a legacy `#/display...` hash to its browser
// route; an SSO handoff fragment (`#code=...`) has a different prefix and
// must pass through untouched, since RootRoute consumes it separately.

export function convertLegacyKioskHash(hash: string): string | null {
  if (!hash.startsWith("#/display")) return null;
  return hash.slice(1) || "/display";
}
