import { Link } from "react-router-dom";

export function SettingsIndexPage() {
  return (
    <section>
      <div className="view-head"><h1>Settings</h1></div>
      <ul>
        <li><Link to="/app/settings/organization">Organization</Link></li>
        <li><Link to="/app/settings/plan">Plan</Link></li>
      </ul>
    </section>
  );
}
