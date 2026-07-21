// Pure decision-logic tests for the routing/auth boundary
// (resolveManagerDestination, resolveGuardState).
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

const mockLoadAccountContext = vi.fn();
vi.mock("../auth/organization-context", async (importActual) => {
  const actual = await importActual<typeof import("../auth/organization-context")>();
  return { ...actual, loadAccountContext: () => mockLoadAccountContext() };
});

const ACCOUNT_WITH_TEAM = {
  userId: "user-1",
  profile: { displayName: "Ada", avatarUrl: null, onboardingState: "complete" },
  team: { id: "org-1", name: "Acme", slug: "acme", status: "active" as const, role: "owner" as const },
};

const ACCOUNT_WITHOUT_TEAM = {
  userId: "user-1",
  profile: { displayName: "Ada", avatarUrl: null, onboardingState: "complete" },
  team: null,
};

beforeEach(() => vi.clearAllMocks());

describe("resolveManagerDestination (backs / and /login)", () => {
  it("targets /login when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { resolveManagerDestination } = await import("./authResolution");
    await expect(resolveManagerDestination()).resolves.toEqual({ to: "/login" });
  });

  it("targets /app/home for any authenticated session, Team or not", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    const { resolveManagerDestination } = await import("./authResolution");
    await expect(resolveManagerDestination()).resolves.toEqual({ to: "/app/home" });
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

  it("resolves 'ready' with a session and an active Team", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadAccountContext.mockResolvedValue(ACCOUNT_WITH_TEAM);
    const { resolveGuardState } = await import("./ManagerGuard");
    await expect(resolveGuardState()).resolves.toEqual({ status: "ready", account: ACCOUNT_WITH_TEAM });
  });

  it("resolves 'ready' with a session and no Team (Team is optional, not an error)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadAccountContext.mockResolvedValue(ACCOUNT_WITHOUT_TEAM);
    const { resolveGuardState } = await import("./ManagerGuard");
    await expect(resolveGuardState()).resolves.toEqual({ status: "ready", account: ACCOUNT_WITHOUT_TEAM });
  });

  it("resolves 'error' with a message when account context fails to load", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadAccountContext.mockRejectedValue(new Error("Your account profile is still being set up."));
    const { resolveGuardState } = await import("./ManagerGuard");
    await expect(resolveGuardState()).resolves.toEqual({ status: "error", message: "Your account profile is still being set up." });
  });

  it("resolves 'error' even when the rejection is not an Error instance", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mockLoadAccountContext.mockRejectedValue("a plain string rejection");
    const { resolveGuardState } = await import("./ManagerGuard");
    const state = await resolveGuardState();
    expect(state.status).toBe("error");
  });
});
