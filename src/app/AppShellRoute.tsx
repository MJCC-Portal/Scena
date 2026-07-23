// Application shell for /app/* with the selected Workspace exposed by
// ManagerGuard. Visual Workspace switching lands with the UI phase; the
// workspace-context API and account context already support it.

import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useManagerContext } from "./ManagerContextProvider";
import { signOut } from "../auth/session";
import * as Locations from "../domain/locations";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ to: string; label: string }>;
}> = [
  {
    label: "Overview",
    items: [
      { to: "/app/home", label: "Home" },
      { to: "/app/locations", label: "Locations" },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/app/menus", label: "Menus" },
      { to: "/app/scenes", label: "Scenes" },
      { to: "/app/layouts", label: "Layouts" },
      { to: "/app/presentations", label: "Presentations" },
    ],
  },
  {
    label: "Display",
    items: [
      { to: "/app/screens", label: "Screens" },
      { to: "/app/sessions", label: "Sessions" },
      { to: "/app/automations", label: "Automations" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/app/members", label: "Members" },
      { to: "/app/settings", label: "Settings" },
    ],
  },
];

export function AppShellRoute() {
  const context = useManagerContext();
  const [locations, setLocations] = useState<Locations.Location[]>([]);

  useEffect(() => {
    Locations.listLocations(context.workspace.id)
      .then(setLocations)
      .catch(() => {});
  }, [context.workspace.id]);

  return (
    <div className="shell" style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        className="rail"
        aria-label="Main"
        style={{ width: 200, flexShrink: 0, padding: 16 }}
      >
        <div className="wordmark">
          <span className="bulbs" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          SCENA
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ marginTop: 16 }}>
            <div className="rail-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "nav-btn active" : "nav-btn"
                }
                style={{ display: "block" }}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="rail-foot" style={{ marginTop: 24 }}>
          <button className="nav-btn" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </nav>

      <main className="main" style={{ flex: 1, padding: 16 }}>
        <header
          data-workspace-id={context.workspace.id}
          style={{ marginBottom: 16 }}
        >
          Workspace <b>{context.workspace.name}</b> · {context.workspace.type} ·{" "}
          {context.role}
          {context.workspaces.length > 1 && (
            <span> · {context.workspaces.length} available Workspaces</span>
          )}
          {locations.length > 0 && (
            <span>
              {" "}
              · {locations.length} location{locations.length === 1 ? "" : "s"}
            </span>
          )}
        </header>
        <Outlet />
      </main>
    </div>
  );
}
