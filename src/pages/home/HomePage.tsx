import { useManagerContext } from "../../app/ManagerContextProvider";

export function HomePage() {
  const context = useManagerContext();
  return (
    <section>
      <div className="view-head">
        <h1>Welcome</h1>
        <p>Signed in to <b>{context.organization.name}</b> as {context.role}.</p>
      </div>
      <p className="muted">Use the navigation to manage locations, menus, scenes, layouts, screens, sessions, and automations.</p>
    </section>
  );
}
