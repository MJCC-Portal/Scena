import { describe, expect, it, vi, beforeEach } from "vitest";

// Minimal fluent stub of the supabase-js query builder: every chain method
// returns itself, and the object is awaitable (delegates to a resolved
// {data, error, count} result) whether or not a terminal method like
// maybeSingle() is called — mirroring the real client's thenable builder.
function stubQuery(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    delete: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const fromMock = vi.fn();
const mockSupabase = { from: (table: string) => fromMock(table) };
vi.mock("../services/supabase/client", () => ({
  requireSupabase: () => mockSupabase,
  callEdgeFunction: (...args: unknown[]) => mockCallEdgeFunction(...args),
}));
const mockCallEdgeFunction = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const ASSET_ID = "22222222-2222-2222-2222-222222222222";

describe("listAssets", () => {
  it("returns Team-scoped assets", async () => {
    fromMock.mockReturnValue(stubQuery({ data: [{ id: ASSET_ID, org_id: ORG_ID }], error: null }));
    const { listAssets } = await import("./assets");
    const result = await listAssets(ORG_ID);
    expect(fromMock).toHaveBeenCalledWith("presentation_assets");
    expect(result).toHaveLength(1);
  });

  it("rejects an invalid org_id before touching the network", async () => {
    const { listAssets } = await import("./assets");
    await expect(listAssets("not-a-uuid")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("getAsset", () => {
  it("returns null when the asset doesn't exist or isn't in this Team", async () => {
    fromMock.mockReturnValue(stubQuery({ data: null, error: null }));
    const { getAsset } = await import("./assets");
    await expect(getAsset(ORG_ID, ASSET_ID)).resolves.toBeNull();
  });
});

describe("deleteAsset", () => {
  it("refuses to delete an asset referenced by a scene (RESOURCE_CONFLICT, not a raw FK error)", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "scenes") return stubQuery({ count: 2, error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const { deleteAsset } = await import("./assets");
    await expect(deleteAsset(ORG_ID, ASSET_ID)).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
      details: { referencing_scenes: 2 },
    });
  });

  it("deletes when nothing references it", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "scenes") return stubQuery({ count: 0, error: null });
      if (table === "presentation_assets") return stubQuery({ error: null, count: 1 });
      throw new Error(`unexpected table ${table}`);
    });
    const { deleteAsset } = await import("./assets");
    await expect(deleteAsset(ORG_ID, ASSET_ID)).resolves.toBeUndefined();
  });

  it("returns RESOURCE_NOT_FOUND when nothing was actually deleted", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "scenes") return stubQuery({ count: 0, error: null });
      if (table === "presentation_assets") return stubQuery({ error: null, count: 0 });
      throw new Error(`unexpected table ${table}`);
    });
    const { deleteAsset } = await import("./assets");
    await expect(deleteAsset(ORG_ID, ASSET_ID)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});

describe("createAssetUpload / confirmAssetUpload", () => {
  it("validates the filename before calling the edge function", async () => {
    const { createAssetUpload } = await import("./assets");
    await expect(createAssetUpload("not-a-slide-deck.txt")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(mockCallEdgeFunction).not.toHaveBeenCalled();
  });

  it("wraps presentation-upload's create action", async () => {
    mockCallEdgeFunction.mockResolvedValue({ asset_id: ASSET_ID, upload_url: "https://lxc.example/put", source_key: "k1" });
    const { createAssetUpload } = await import("./assets");
    const result = await createAssetUpload("deck.pptx");
    expect(mockCallEdgeFunction).toHaveBeenCalledWith("presentation-upload", { action: "create", filename: "deck.pptx" });
    expect(result).toEqual({ asset_id: ASSET_ID, upload_url: "https://lxc.example/put", upload_method: "PUT" });
  });

  it("wraps presentation-upload's complete action", async () => {
    mockCallEdgeFunction.mockResolvedValue({ asset_id: ASSET_ID, status: "uploaded" });
    const { confirmAssetUpload } = await import("./assets");
    const result = await confirmAssetUpload(ASSET_ID);
    expect(mockCallEdgeFunction).toHaveBeenCalledWith("presentation-upload", { action: "complete", asset_id: ASSET_ID });
    expect(result.status).toBe("uploaded");
  });
});
