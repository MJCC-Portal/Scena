import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Archive, Images } from "@phosphor-icons/react";
import {
  getAsset, archiveAsset, signAssetRead, selectAssetPreviewVariant,
} from "../../services/scena-api/assets";
import type { AssetDetailResponse } from "../../services/scena-api/assets";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusIndicator } from "../../components/ui/Badge";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Skeleton } from "../../components/ui/Skeleton";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";

export function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState<AssetDetailResponse | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!assetId) return;
    let active = true;
    let objectUrl: string | null = null;

    getAsset(assetId)
      .then(async (res) => {
        if (!active) return;
        setDetail(res);
        const variant = selectAssetPreviewVariant(res, "full");
        if (variant) {
          const signed = await signAssetRead(assetId, variant.id);
          if (active) setPreviewUrl(signed.signed_url);
        }
      })
      .catch((err) => active && setError(err));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  async function handleArchive() {
    if (!assetId) return;
    setArchiving(true);
    try {
      await archiveAsset(assetId);
      toast.show("Asset archived", "success");
      navigate("/app/assets");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't archive Asset.", "danger");
      setArchiving(false);
      setConfirmArchive(false);
    }
  }

  if (error) {
    return (
      <div className="scena-page">
        <ErrorBanner error={error} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="scena-page">
        <Skeleton height={320} />
      </div>
    );
  }

  const { asset, pages, variants, jobs } = detail;

  return (
    <div className="scena-page">
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate("/app/assets")}>
        Back to Assets
      </Button>

      <PageHeader
        title={asset.original_filename}
        description={`${asset.asset_kind} · ${asset.page_count ?? 0} page(s) · ${formatBytes(asset.source_size_bytes)}`}
        actions={
          <Button variant="danger" icon={<Archive size={18} />} onClick={() => setConfirmArchive(true)} disabled={asset.status === "archived"}>
            Archive
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24, alignItems: "start" }}>
        <Card>
          <div style={{ aspectRatio: "16/9", background: "var(--scena-surface-3)", borderRadius: "var(--scena-radius-md)", display: "grid", placeItems: "center", overflow: "hidden" }}>
            {previewUrl ? (
              <img src={previewUrl} alt={asset.original_filename} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <Images size={40} style={{ color: "var(--scena-text-muted)" }} />
            )}
          </div>
          {asset.status === "failed" && asset.error_message_safe && (
            <div style={{ marginTop: 16 }}>
              <ErrorBanner error={Object.assign(new Error(asset.error_message_safe), { code: asset.error_code ?? undefined })} />
            </div>
          )}
          {pages.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="scena-section-header"><h2 className="scena-section-header__title" style={{ fontSize: "var(--scena-text-base)" }}>Pages</h2></div>
              <div className="scena-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
                {pages.map((page) => (
                  <div key={page.id} style={{ aspectRatio: "16/9", background: "var(--scena-surface-2)", borderRadius: "var(--scena-radius-sm)", display: "grid", placeItems: "center", fontSize: "var(--scena-text-xs)", color: "var(--scena-text-muted)" }}>
                    Page {page.page_number}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)", marginBottom: 8 }}>Status</div>
            <StatusIndicator status={asset.status} />
            <div style={{ marginTop: 16, fontSize: "var(--scena-text-sm)", color: "var(--scena-text-secondary)", display: "grid", gap: 6 }}>
              <span>Uploaded: {asset.source_uploaded_at ? new Date(asset.source_uploaded_at).toLocaleString() : "—"}</span>
              <span>Processed: {asset.processed_at ? new Date(asset.processed_at).toLocaleString() : "—"}</span>
              <span>{variants.length} generated variant(s)</span>
            </div>
          </Card>

          {jobs.length > 0 && (
            <Card>
              <div style={{ fontSize: "var(--scena-text-xs)", textTransform: "uppercase", color: "var(--scena-text-muted)", marginBottom: 8 }}>Processing history</div>
              <div style={{ display: "grid", gap: 8 }}>
                {jobs.map((job) => (
                  <div key={job.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--scena-text-xs)" }}>
                    <span style={{ color: "var(--scena-text-secondary)" }}>{job.job_type}</span>
                    <StatusIndicator status={job.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title="Archive this Asset?"
        description="Archiving doesn't refund the monthly upload it counted against, and removes it from Boards that reference it."
        confirmLabel="Archive"
        danger
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setConfirmArchive(false)}
      />
    </div>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "unknown size";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
