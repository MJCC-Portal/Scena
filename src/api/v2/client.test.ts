import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("../../services/supabase/client", () => ({
  requireSupabase: () => ({ auth: { getSession: () => mockGetSession() } }),
  supabaseUrl: "https://example.test",
  supabaseKey: "anon-key",
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: "user-token" } } });
});

describe("requestV2", () => {
  it("attaches the bearer token, apikey, and a generated request ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ data: { ok: true }, meta: { api_version: "2", request_id: "server-req-id" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { requestV2 } = await import("./client");
    const result = await requestV2<{ ok: boolean }>("teams/current");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/functions/v1/scena-api/v2/teams/current");
    expect(init.headers.authorization).toBe("Bearer user-token");
    expect(init.headers.apikey).toBe("anon-key");
    expect(init.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.data.ok).toBe(true);

    vi.unstubAllGlobals();
  });

  it("uses a caller-supplied request ID and idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ data: {}, meta: { api_version: "2", request_id: "caller-req-id" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { requestV2 } = await import("./client");
    await requestV2("teams", { method: "POST", body: { name: "Acme" }, requestId: "caller-req-id", idempotencyKey: "idem-1" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["x-request-id"]).toBe("caller-req-id");
    expect(init.headers["x-idempotency-key"]).toBe("idem-1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Acme" });

    vi.unstubAllGlobals();
  });

  it("throws ApiError when the server returns an error envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 403,
      json: async () => ({ error: { code: "TEAM_REQUIRED", message: "Create a Team first.", request_id: "req-2" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { requestV2 } = await import("./client");
    const { ApiError } = await import("./errors");
    await expect(requestV2("boards")).rejects.toMatchObject({ code: "TEAM_REQUIRED", status: 403 });
    await expect(requestV2("boards")).rejects.toBeInstanceOf(ApiError);

    vi.unstubAllGlobals();
  });

  it("throws ApiV2TransportError on a malformed (non-JSON) response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 500,
      json: async () => { throw new SyntaxError("not json"); },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { requestV2 } = await import("./client");
    const { ApiV2TransportError } = await import("./errors");
    await expect(requestV2("boards")).rejects.toBeInstanceOf(ApiV2TransportError);

    vi.unstubAllGlobals();
  });

  it("throws ApiV2TransportError on a well-formed but non-envelope JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ unexpected: "shape" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { requestV2 } = await import("./client");
    const { ApiV2TransportError } = await import("./errors");
    await expect(requestV2("boards")).rejects.toBeInstanceOf(ApiV2TransportError);

    vi.unstubAllGlobals();
  });

  it("throws UNAUTHENTICATED when there is no session and anonymous access isn't allowed", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { requestV2 } = await import("./client");
    await expect(requestV2("boards")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
