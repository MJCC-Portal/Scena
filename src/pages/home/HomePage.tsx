// Search-first Home dashboard — real data only. Board/Asset recents and
// counts come from the live scena-api client (listBoards/listAssets), not
// from src/domain/dashboard.ts's board_count/asset_count (those still count
// the legacy display_layouts/presentation_assets tables, superseded by the
// canonical boards/assets tables shipped in v1.0.13). Display online-count
// still comes from dashboard.ts, since that threshold logic is real and
// unrelated to the Board/Asset migration.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  SquaresFour, Images, Monitor, Plus, ArrowRight,
} from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { getDashboardSummary } from "../../domain/dashboard";
import { listBoards } from "../../services/scena-api/boards";
import type { BoardSummary } from "../../services/scena-api/boards";
import { listAssets } from "../../services/scena-api/assets";
import type { AssetSummary } from "../../services/scena-api/assets";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/Input";
import { GridCard, Grid, Card } from "../../components/ui/Card";
import { StatusIndicator } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

interface LoadState {
  boards: BoardSummary[];
  assets: AssetSummary[];
  displayCount: number;
  displaysOnline: number;
}

export function HomePage() {
  const context = useManagerContext();
  const [state, setState] = useState<LoadState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError(null);
    setState(null);

    Promise.all([
      listBoards(context.workspace.id, 8),
      listAssets(context.workspace.id, { limit: 8 }),
      getDashboardSummary(context.workspace.id).catch(() => null),
    ])
      .then(([boardsRes, assetsRes, summary]) => {
        if (!active) return;
        setState({
          boards: boardsRes.boards,
          assets: assetsRes.assets,
          displayCount: summary?.display_count ?? 0,
          displaysOnline: summary?.displays_online ?? 0,
        });
      })
      .catch((err) => {
        if (active) setError(err);
      });

    return () => {
      active = false;
    };
  }, [context.workspace.id, reloadKey]);

  const entitlements = context.workspace.entitlements;
  const filteredBoards = state?.boards.filter((board) => board.name.toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <div className="scena-page">
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontFamily: "var(--scena-font-display)", fontSize: "var(--scena-text-3xl)", marginBottom: 16 }}>
          What will you build today, {context.profile.displayName || "there"}?
        </h1>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <SearchInput
            uiSize="lg"
            placeholder="Search Boards and Assets"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
          <Link to="/app/boards/new"><Button variant="primary" icon={<Plus size={18} />}>New Board</Button></Link>
          <Link to="/app/assets"><Button variant="secondary" icon={<Images size={18} />}>Upload Asset</Button></Link>
        </div>
      </div>

      {error ? (
        <ErrorBanner error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !state ? (
        <div style={{ display: "grid", gap: 16 }}>
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      ) : (
        <>
          <section style={{ marginBottom: 40 }}>
            <div className="scena-section-header">
              <h2 className="scena-section-header__title">Workspace summary</h2>
            </div>
            <div className="scena-value-grid">
              <SummaryTile icon={<SquaresFour size={20} />} label="Boards" value={`${state.boards.length}${entitlements ? ` / ${entitlements.max_boards}` : ""}`} />
              <SummaryTile icon={<Images size={20} />} label="Assets" value={String(state.assets.length)} />
              <SummaryTile icon={<Monitor size={20} />} label="Displays online" value={`${state.displaysOnline} / ${state.displayCount}${entitlements ? ` (limit ${entitlements.max_displays})` : ""}`} />
              <SummaryTile
                icon={<SquaresFour size={20} />}
                label="Plan"
                value={entitlements ? capitalize(entitlements.plan_code) : context.workspace.type === "personal" ? "Personal Free" : "—"}
              />
            </div>
          </section>

          <section style={{ marginBottom: 40 }}>
            <div className="scena-section-header">
              <h2 className="scena-section-header__title">Recent Boards</h2>
              <Link to="/app/boards"><Button variant="ghost" size="sm" icon={<ArrowRight size={16} />}>View all</Button></Link>
            </div>
            {filteredBoards.length === 0 ? (
              <EmptyState
                icon={<SquaresFour size={32} />}
                title="No Boards yet"
                description="Create your first Board to start designing for your Displays."
                action={<Link to="/app/boards/new"><Button variant="primary" size="sm">Create Board</Button></Link>}
              />
            ) : (
              <Grid>
                {filteredBoards.map((board) => (
                  <Link key={board.id} to={`/app/boards/${board.id}`} style={{ display: "block" }}>
                    <GridCard
                      thumb={<SquaresFour size={28} />}
                      title={board.name}
                      meta={`${board.canvas_width} × ${board.canvas_height} · v${board.version}`}
                    />
                  </Link>
                ))}
              </Grid>
            )}
          </section>

          <section>
            <div className="scena-section-header">
              <h2 className="scena-section-header__title">Recent Assets</h2>
              <Link to="/app/assets"><Button variant="ghost" size="sm" icon={<ArrowRight size={16} />}>View all</Button></Link>
            </div>
            {state.assets.length === 0 ? (
              <EmptyState
                icon={<Images size={32} />}
                title="No Assets yet"
                description="Upload an image, PDF, or PowerPoint file to use in a Board."
                action={<Link to="/app/assets"><Button variant="primary" size="sm">Upload Asset</Button></Link>}
              />
            ) : (
              <Grid>
                {state.assets.map((asset) => (
                  <Link key={asset.id} to={`/app/assets/${asset.id}`} style={{ display: "block" }}>
                    <GridCard
                      thumb={<Images size={28} />}
                      title={asset.original_filename}
                      meta={<StatusIndicator status={asset.status} />}
                    />
                  </Link>
                ))}
              </Grid>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--scena-text-muted)", marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "var(--scena-font-display)", fontSize: "var(--scena-text-xl)" }}>{value}</div>
    </Card>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
