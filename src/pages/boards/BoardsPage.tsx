import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SquaresFour, Plus, DotsThreeVertical, Archive } from "@phosphor-icons/react";
import { useManagerContext } from "../../app/ManagerContextProvider";
import { listBoards, archiveBoard } from "../../services/scena-api/boards";
import type { BoardSummary } from "../../services/scena-api/boards";
import { PageHeader } from "../../components/ui/PageHeader";
import { SearchInput } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { GridCard, Grid } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { DropdownMenu } from "../../components/ui/Menu";
import { IconButton } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";

export function BoardsPage() {
  const context = useManagerContext();
  const navigate = useNavigate();
  const toast = useToast();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<BoardSummary | null>(null);
  const [archiving, setArchiving] = useState(false);

  function load() {
    setError(null);
    listBoards(context.workspace.id, 100)
      .then((res) => setBoards(res.boards))
      .catch(setError);
  }

  useEffect(load, [context.workspace.id]);

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveBoard(archiveTarget.id);
      setBoards((prev) => prev?.filter((board) => board.id !== archiveTarget.id) ?? null);
      toast.show("Board archived", "success");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't archive Board.", "danger");
    } finally {
      setArchiving(false);
      setArchiveTarget(null);
    }
  }

  const filtered = boards?.filter((board) => board.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  const atLimit = context.workspace.entitlements && boards ? boards.length >= context.workspace.entitlements.max_boards : false;

  return (
    <div className="scena-page">
      <PageHeader
        title="Boards"
        description="Design canvases for your Displays."
        actions={
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => navigate("/app/boards/new")} disabled={atLimit}>
            Create Board
          </Button>
        }
      />

      <div className="scena-filter-bar">
        <SearchInput placeholder="Search Boards" value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 320 }} />
      </div>

      {atLimit && (
        <div style={{ marginBottom: 20 }}>
          <ErrorBanner
            error={Object.assign(new Error(`You've reached your plan's Board limit (${context.workspace.entitlements?.max_boards}). Archive a Board or upgrade your Workspace to create another.`), { code: "BOARD_LIMIT_REACHED" })}
          />
        </div>
      )}

      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : !boards ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {[1, 2, 3].map((key) => <Skeleton key={key} height={180} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SquaresFour size={32} />}
          title={boards.length === 0 ? "No Boards yet" : "No Boards match your search"}
          description={boards.length === 0 ? "Create your first Board to start designing." : undefined}
          action={boards.length === 0 && <Button variant="primary" size="sm" onClick={() => navigate("/app/boards/new")}>Create Board</Button>}
        />
      ) : (
        <Grid>
          {filtered.map((board) => (
            <div key={board.id} style={{ position: "relative" }}>
              <Link to={`/app/boards/${board.id}`} style={{ display: "block" }}>
                <GridCard
                  thumb={<SquaresFour size={28} />}
                  title={board.name}
                  meta={`${board.canvas_width} × ${board.canvas_height} · v${board.version} · Updated ${formatDate(board.updated_at)}`}
                />
              </Link>
              <div style={{ position: "absolute", top: 8, right: 8 }}>
                <DropdownMenu
                  trigger={<IconButton icon={<DotsThreeVertical size={18} />} label="Board actions" size="sm" />}
                  items={[
                    { key: "archive", icon: <Archive size={16} />, label: "Archive", danger: true, onSelect: () => setArchiveTarget(board) },
                  ]}
                />
              </div>
            </div>
          ))}
        </Grid>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        title={`Archive "${archiveTarget?.name}"?`}
        description="Archived Boards are hidden from this list. This does not delete the Board."
        confirmLabel="Archive"
        danger
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
