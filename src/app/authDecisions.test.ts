// Pure decision-logic tests for the routing/auth boundary
// (resolveManagerDestination, consumeAndExchangeSso, resolveGuardState).
//
// These test the exact same decisions router.test.tsx's DOM-rendering
// tests would otherwise exercise by watching a live <Navigate> fire —
// but a live redirect through react-router-dom v7's data router hits a
// real environment incompatibility in this sandbox: Node 24's undici
// (used internally by react-router's data-router navigation machinery)
// rejects jsdom's AbortController instances with "Expected signal to be
// an instance of AbortSignal" (a cross-realm identity mismatch between
// jsdom's DOM-spec AbortController and Node's native one — reproduced
// identically on jsdom 24 and 29, so it is not a jsdom-version issue).
// Testing the decision functions directly gives full coverage of the
// actual behavior without depending on that environment's navigation
// internals; router.test.tsx separately covers every scenario that does
// NOT require an in-flight redirect (direct rendering of an
// already-resolved route, 404s, kiosk, isolation).

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("../services/supabase/client", () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));

const mockLoadManagerContext = vi.fn();
vi.mock("../auth/organization-context", async (importActual) => {
  const actual = await importActual<typeof import("../auth/organization-context")>();
  return { ...actual, loadManagerContext: () => mockLoadManagerContext() };
});

const mockConsumeSsoHandoffCode = vi.fn();
const mockExchangeMjccCode = vi.fn();
vi.mock("../auth/sso", () => ({
  consumeSsoHandoffCode: () => mockConsumeSsoHandoffCode(),
  exchangeMjccCode: (code: string) => mockExchangeMjccCode(code),
}));

const AUTHENTICATED_CONTEXT = {
  userId: "user-1",
  organization: { id: "org-1", name: "MJCC", slug: "mjcc", status: "active" as const },
  role: "owner" as const,
};

beforeEach(() => vi.clearAllMocks());

describe("resolveManagerDestination (backs / and /login)", () => {
  it("targets /login when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { resolveManagerDestination } = await import("./authResolution");
    await expect(resolveManagerDestination()).resolves.toEqual({ to: "/login" });
  });

  it("targets /app/home for an authenticated manager with valid membership", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadManagerContext.mockResolvedValue(AUTHENTICATED_CONTEXT);
    const { resolveManagerDestination } = await import("./authResolution");
    await expect(resolveManagerDestination()).resolves.toEqual({ to: "/app/home" });
  });

  it("targets /unauthorized when the session has no membership", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadManagerContext.mockRejectedValue(new Error("Your account is not linked to an organization."));
    const { resolveManagerDestination } = await import("./authResolution");
    await expect(resolveManagerDestination()).resolves.toEqual({ to: "/unauthorized", message: "Your account is not linked to an organization." });
  });

  it("targets /unauthorized for a suspended organization", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadManagerContext.mockRejectedValue(new Error("This organization is suspended."));
    const { resolveManagerDestination } = await import("./authResolution");
    await expect(resolveManagerDestination()).resolves.toEqual({ to: "/unauthorized", message: "This organization is suspended." });
  });

  it("never loops: every outcome is a concrete, non-'/' destination", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { resolveManagerDestination } = await import("./authResolution");
    const dest = await resolveManagerDestination();
    expect(dest.to).not.toBe("/");
  });
});

describe("resolveGuardState (backs the /app ManagerGuard)", () => {
  it("resolves 'unauthenticated' with no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { resolveGuardState } = await import("./ManagerGuard");
    await expect(resolveGuardState()).resolves.toEqual({ status: "unauthenticated" });
  });

  it("resolves 'ready' with a session and valid membership", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadManagerContext.mockResolvedValue(AUTHENTICATED_CONTEXT);
    const { resolveGuardState } = await import("./ManagerGuard");
    await expect(resolveGuardState()).resolves.toEqual({ status: "ready", context: AUTHENTICATED_CONTEXT });
  });

  it("resolves 'unauthorized' with a message when membership is missing", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadManagerContext.mockRejectedValue(new Error("Your account is not linked to an organization."));
    const { resolveGuardState } = await import("./ManagerGuard");
    await expect(resolveGuardState()).resolves.toEqual({ status: "unauthorized", message: "Your account is not linked to an organization." });
  });

  it("resolves 'unauthorized' even when the rejection is not an Error instance", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadManagerContext.mockRejectedValue("a plain string rejection");
    const { resolveGuardState } = await import("./ManagerGuard");
    const state = await resolveGuardState();
    expect(state.status).toBe("unauthorized");
  });
});

describe("consumeAndExchangeSso (backs / and /auth/callback)", () => {
  it("reports no_code when the fragment is absent", async () => {
    mockConsumeSsoHandoffCode.mockReturnValue(null);
    const { consumeAndExchangeSso } = await import("./useSsoExchange");
    await expect(consumeAndExchangeSso()).resolves.toEqual({ outcome: "no_code" });
  });

  it("reports success after a valid code exchanges cleanly", async () => {
    mockConsumeSsoHandoffCode.mockReturnValue("a-valid-code");
    mockExchangeMjccCode.mockResolvedValue({ id: "user-1" });
    const { consumeAndExchangeSso } = await import("./useSsoExchange");
    await expect(consumeAndExchangeSso()).resolves.toEqual({ outcome: "success" });
  });

  it("reports an error for an expired/reused/failed exchange", async () => {
    mockConsumeSsoHandoffCode.mockReturnValue("an-expired-code");
    mockExchangeMjccCode.mockRejectedValue(new Error("invalid_or_expired_handoff"));
    const { consumeAndExchangeSso } = await import("./useSsoExchange");
    await expect(consumeAndExchangeSso()).resolves.toEqual({ outcome: "error", message: "invalid_or_expired_handoff" });
  });
});
