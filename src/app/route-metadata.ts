// Route status metadata — used by PlaceholderPage and, later, by any
// navigation component that wants to grey out or badge unimplemented
// sections. This is a truthful inventory, not a feature flag system: it
// records what's real today, nothing more.
//
// "functional" = real domain-service calls, real data, real writes.
// "placeholder" = route exists and is reachable (deep-linkable,
//   refresh-safe), but the page body is a stated placeholder pending the
//   manager UI phase — no fake data, no fake actions.

export type RouteStatus = "functional" | "placeholder";

export interface RouteMeta {
  path: string;
  label: string;
  status: RouteStatus;
  note?: string;
}

export const ROUTE_METADATA: RouteMeta[] = [
  { path: "/app/home", label: "Home", status: "functional" },
  { path: "/app/locations", label: "Locations", status: "functional" },
  { path: "/app/locations/:locationId", label: "Location detail", status: "placeholder" },
  { path: "/app/menus", label: "Menus", status: "functional" },
  { path: "/app/menus/new", label: "New menu", status: "functional" },
  { path: "/app/menus/:menuId", label: "Menu detail", status: "placeholder" },
  { path: "/app/menus/:menuId/edit", label: "Menu editor", status: "placeholder", note: "Section/item editing exists in src/domain/menus.ts; no editor UI yet." },
  { path: "/app/scenes", label: "Scenes", status: "functional" },
  { path: "/app/scenes/new", label: "New scene", status: "functional" },
  { path: "/app/scenes/:sceneId", label: "Scene detail", status: "placeholder" },
  { path: "/app/scenes/:sceneId/edit", label: "Scene editor", status: "placeholder" },
  { path: "/app/layouts", label: "Layouts", status: "functional" },
  { path: "/app/layouts/new", label: "New layout", status: "functional" },
  { path: "/app/layouts/:layoutId", label: "Layout detail", status: "placeholder" },
  { path: "/app/layouts/:layoutId/edit", label: "Layout editor", status: "placeholder", note: "Tile CRUD exists in src/domain/layouts.ts; no tile editor UI yet." },
  { path: "/app/presentations", label: "Presentations", status: "placeholder", note: "presentation-upload Edge Function is deployed; src/domain/assets.ts (list/get/delete/upload-wrapper) now exists; no upload/library UI yet." },
  { path: "/app/presentations/:presentationId", label: "Presentation detail", status: "placeholder" },
  { path: "/app/screens", label: "Screens", status: "functional" },
  { path: "/app/screens/pair", label: "Pair a screen", status: "functional" },
  { path: "/app/screens/:screenId", label: "Screen detail", status: "placeholder", note: "rename/reassign/revoke/rotate-credential exist in src/domain/screens.ts; no detail UI yet." },
  { path: "/app/sessions", label: "Sessions", status: "functional" },
  { path: "/app/sessions/new", label: "New session", status: "functional" },
  { path: "/app/sessions/:sessionId", label: "Session detail", status: "placeholder" },
  { path: "/app/sessions/:sessionId/edit", label: "Session composer", status: "placeholder", note: "screen-assignment/display-mode/viewport services exist; no composer UI yet." },
  { path: "/app/sessions/:sessionId/live", label: "Live session", status: "placeholder" },
  { path: "/app/automations", label: "Automations", status: "functional", note: "Read-only list — create/edit/disable services exist but have no UI yet." },
  { path: "/app/automations/new", label: "New automation", status: "placeholder" },
  { path: "/app/automations/:automationId", label: "Automation detail", status: "placeholder" },
  { path: "/app/automations/:automationId/edit", label: "Automation editor", status: "placeholder" },
  { path: "/app/members", label: "Members", status: "placeholder", note: "listMembers/upsertMember/removeMember exist in src/domain/organizations.ts; no UI yet." },
  { path: "/app/settings", label: "Settings", status: "placeholder" },
  { path: "/app/settings/organization", label: "Organization settings", status: "placeholder", note: "No organization-update service exists yet — backend gap, not just UI." },
  { path: "/app/settings/plan", label: "Plan", status: "functional", note: "Read-only entitlement display." },
];
