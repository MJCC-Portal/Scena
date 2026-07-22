import { describe, expect, it, vi, beforeEach } from "vitest";

function stubQuery(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const fromMock = vi.fn();
vi.mock("../services/supabase/client", () => ({
  requireSupabase: () => ({ from: (table: string) => fromMock(table) }),
}));

beforeEach(() => vi.clearAllMocks());

const ORG_ID = "11111111-1111-1111-1111-111111111111";

describe("getDashboardSummary", () => {
  it("aggregates real counts and the plan entitlement — no fabricated fields", async () => {
    let screensCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "display_layouts") return stubQuery({ count: 4, error: null });
      if (table === "presentation_assets") return stubQuery({ count: 7, error: null });
      if (table === "screens") {
        screensCalls += 1;
        // 1st call: total display count. 2nd call: online-within-window count.
        return stubQuery({ count: screensCalls === 1 ? 3 : 1, error: null });
      }
      if (table === "organization_entitlements") {
        return stubQuery({ data: { plan_code: "pro", max_displays_per_session: 4 }, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { getDashboardSummary } = await import("./dashboard");
    const summary = await getDashboardSummary(ORG_ID);

    expect(summary).toEqual({
      board_count: 4,
      asset_count: 7,
      display_count: 3,
      displays_online: 1,
      plan: { plan_code: "pro", max_displays_per_session: 4 },
    });
    expect(screensCalls).toBe(2);
  });

  it("rejects an invalid org_id before touching the network", async () => {
    const { getDashboardSummary } = await import("./dashboard");
    await expect(getDashboardSummary("not-a-uuid")).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("surfaces a missing entitlement as RESOURCE_NOT_FOUND, not a silent zero-plan dashboard", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "organization_entitlements") return stubQuery({ data: null, error: null });
      return stubQuery({ count: 0, error: null });
    });
    const { getDashboardSummary } = await import("./dashboard");
    await expect(getDashboardSummary(ORG_ID)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
  });
});
