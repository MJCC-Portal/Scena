import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../services/supabase/client", () => ({
  requireSupabase: () => ({ auth }),
}));

import { completeAuthRedirect, resolveAuthRedirect } from "./session";

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
});

describe("resolveAuthRedirect", () => {
  it("uses the canonical HTTPS site for a production build", () => {
    expect(resolveAuthRedirect("http://localhost:3000", true)).toBe(
      "https://scena.kpnsolute.com/auth/callback",
    );
  });

  it("uses the current origin during local development", () => {
    expect(resolveAuthRedirect("http://localhost:5173", false)).toBe(
      "http://localhost:5173/auth/callback",
    );
  });
});

describe("completeAuthRedirect", () => {
  it("exchanges a PKCE code, returns the session, and removes the code", async () => {
    const session = { access_token: "test-token", user: { id: "user-1" } };
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    window.history.replaceState(null, "", "/auth/callback?code=single-use-code&next=%2Fapp");

    await expect(completeAuthRedirect(new URL(window.location.href))).resolves.toBe(session);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("single-use-code");
    expect(window.location.pathname).toBe("/auth/callback");
    expect(window.location.search).toBe("?next=%2Fapp");
    expect(window.location.hash).toBe("");
  });

  it("rejects and removes a legacy token fragment", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback#access_token=secret&refresh_token=secret",
    );

    await expect(completeAuthRedirect(new URL(window.location.href))).rejects.toThrow(
      "legacy token-in-URL",
    );
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("returns an existing session when there is no callback code", async () => {
    const session = { access_token: "stored-token", user: { id: "user-1" } };
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(completeAuthRedirect(new URL(window.location.href))).resolves.toBe(session);
  });
});
