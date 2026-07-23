import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("../supabase/client", () => ({
  requireSupabase: () => ({ auth }),
  supabaseUrl: "https://project.supabase.co",
  supabaseKey: "publishable-key",
}));

import { callScenaFunction } from "./client";
import { ScenaApiError } from "./errors";

beforeEach(() => {
  vi.restoreAllMocks();
  auth.getSession.mockReset();
});

describe("callScenaFunction", () => {
  it("fails before the network when no authenticated session exists", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      callScenaFunction("asset-upload", { action: "list" }),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });

  it("preserves API error code, request ID, status, and details", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "BOARD_VERSION_CONFLICT",
            message: "Reload the latest version.",
            request_id: "request-1",
            details: { current_version: 3 },
          },
        }),
        {
          status: 409,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const request = callScenaFunction(
      "board-interaction",
      { action: "save" },
    );

    await expect(request).rejects.toBeInstanceOf(ScenaApiError);
    await expect(request).rejects.toMatchObject({
      code: "BOARD_VERSION_CONFLICT",
      status: 409,
      requestId: "request-1",
      details: { current_version: 3 },
    });
  });

  it("returns a successful JSON response", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ assets: [], request_id: "request-2" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      callScenaFunction<{ assets: unknown[] }>(
        "asset-upload",
        { action: "list" },
      ),
    ).resolves.toMatchObject({ assets: [] });
  });
});
