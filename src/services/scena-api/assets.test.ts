import { describe, expect, it } from "vitest";
import { selectAssetPreviewVariant, type AssetDetailResponse } from "./assets";

const detail = {
  pages: [
    { id: "page-1", page_number: 1 },
    { id: "page-2", page_number: 2 },
  ],
  variants: [
    { id: "thumb-1", asset_page_id: "page-1", variant_type: "thumbnail", mime_type: "image/webp", metadata: { page_number: 1 } },
    { id: "full-1", asset_page_id: "page-1", variant_type: "source_render", mime_type: "image/webp", metadata: { page_number: 1 } },
    { id: "thumb-2", asset_page_id: "page-2", variant_type: "thumbnail", mime_type: "image/webp", metadata: { page_number: 2 } },
  ],
} as unknown as Pick<AssetDetailResponse, "variants"> & Partial<Pick<AssetDetailResponse, "pages">>;

describe("asset preview contracts", () => {
  it("selects the requested page and thumbnail/full source", () => {
    expect(selectAssetPreviewVariant(detail, "thumbnail", { pageNumber: 2 })?.id).toBe("thumb-2");
    expect(selectAssetPreviewVariant(detail, "full", { pageId: "page-1" })?.id).toBe("full-1");
  });

  it("ignores non-image variants", () => {
    const nonImage = { ...detail, variants: [{ ...detail.variants[0], mime_type: "application/pdf" }] };
    expect(selectAssetPreviewVariant(nonImage)).toBeNull();
  });
});
