// Browser-history router — replaces the boot-time
// `location.hash.startsWith("#/display")` conditional that used to live
// in src/main.tsx. Manager and kiosk trees are still fully isolated: the
// kiosk subtree imports nothing from src/auth/* or src/app/*, and the
// manager subtree never imports src/lib/display.ts.

import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { RootRoute } from "./RootRoute";
import { ManagerGuard } from "./ManagerGuard";
import { AppShellRoute } from "./AppShellRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { LoginPage } from "../pages/auth/LoginPage";
import { CallbackPage } from "../pages/auth/CallbackPage";
import { UnauthorizedPage } from "../pages/auth/UnauthorizedPage";
import { HomePage } from "../pages/home/HomePage";
import { LocationsPage } from "../pages/locations/LocationsPage";
import { MenusPage } from "../pages/menus/MenusPage";
import { NewMenuPage } from "../pages/menus/NewMenuPage";
import { ScenesPage } from "../pages/scenes/ScenesPage";
import { NewScenePage } from "../pages/scenes/NewScenePage";
import { LayoutsPage } from "../pages/layouts/LayoutsPage";
import { NewLayoutPage } from "../pages/layouts/NewLayoutPage";
import { ScreensPage } from "../pages/screens/ScreensPage";
import { PairScreenPage } from "../pages/screens/PairScreenPage";
import { SessionsPage } from "../pages/sessions/SessionsPage";
import { NewSessionPage } from "../pages/sessions/NewSessionPage";
import { AutomationsPage } from "../pages/automations/AutomationsPage";
import { PlanSettingsPage } from "../pages/settings/PlanSettingsPage";
import { SettingsIndexPage } from "../pages/settings/SettingsIndexPage";
import { NotFoundPage } from "../pages/not-found/NotFoundPage";
import { PlaceholderPage } from "../pages/shared/PlaceholderPage";
import { DisplayRoute } from "../display/DisplayRoute";
import { DisplayErrorBoundary } from "../display/DisplayErrorBoundary";
import { ROUTE_METADATA } from "./route-metadata";

function placeholder(path: string) {
  const meta = ROUTE_METADATA.find((m) => m.path === path);
  return <PlaceholderPage title={meta?.label ?? path} note={meta?.note} />;
}

// Shared between the real browser router below and the memory router
// used in tests (src/app/router.test.tsx) — one source of truth for the
// route tree.
export const routeTree: RouteObject[] = [
  { path: "/", element: <RootRoute /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/auth/callback", element: <CallbackPage /> },
  { path: "/unauthorized", element: <UnauthorizedPage /> },
  {
    path: "/app",
    element: <ManagerGuard />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShellRoute />,
        children: [
          { path: "home", element: <HomePage /> },
          { path: "locations", element: <LocationsPage /> },
          { path: "locations/:locationId", element: placeholder("/app/locations/:locationId") },
          { path: "menus", element: <MenusPage /> },
          { path: "menus/new", element: <NewMenuPage /> },
          { path: "menus/:menuId", element: placeholder("/app/menus/:menuId") },
          { path: "menus/:menuId/edit", element: placeholder("/app/menus/:menuId/edit") },
          { path: "scenes", element: <ScenesPage /> },
          { path: "scenes/new", element: <NewScenePage /> },
          { path: "scenes/:sceneId", element: placeholder("/app/scenes/:sceneId") },
          { path: "scenes/:sceneId/edit", element: placeholder("/app/scenes/:sceneId/edit") },
          { path: "layouts", element: <LayoutsPage /> },
          { path: "layouts/new", element: <NewLayoutPage /> },
          { path: "layouts/:layoutId", element: placeholder("/app/layouts/:layoutId") },
          { path: "layouts/:layoutId/edit", element: placeholder("/app/layouts/:layoutId/edit") },
          { path: "presentations", element: placeholder("/app/presentations") },
          { path: "presentations/:presentationId", element: placeholder("/app/presentations/:presentationId") },
          { path: "screens", element: <ScreensPage /> },
          { path: "screens/pair", element: <PairScreenPage /> },
          { path: "screens/:screenId", element: placeholder("/app/screens/:screenId") },
          { path: "sessions", element: <SessionsPage /> },
          { path: "sessions/new", element: <NewSessionPage /> },
          { path: "sessions/:sessionId", element: placeholder("/app/sessions/:sessionId") },
          { path: "sessions/:sessionId/edit", element: placeholder("/app/sessions/:sessionId/edit") },
          { path: "sessions/:sessionId/live", element: placeholder("/app/sessions/:sessionId/live") },
          { path: "automations", element: <AutomationsPage /> },
          { path: "automations/new", element: placeholder("/app/automations/new") },
          { path: "automations/:automationId", element: placeholder("/app/automations/:automationId") },
          { path: "automations/:automationId/edit", element: placeholder("/app/automations/:automationId/edit") },
          { path: "members", element: placeholder("/app/members") },
          { path: "settings", element: <SettingsIndexPage /> },
          { path: "settings/organization", element: placeholder("/app/settings/organization") },
          { path: "settings/plan", element: <PlanSettingsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  {
    path: "/display",
    element: <DisplayRoute />,
    errorElement: <DisplayErrorBoundary />,
  },
  { path: "*", element: <NotFoundPage /> },
];

export const router = createBrowserRouter(routeTree);
