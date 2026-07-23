import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const completeAuthRedirect = vi.hoisted(() => vi.fn());

vi.mock("../../auth/session", () => ({
  completeAuthRedirect: () => completeAuthRedirect(),
}));

import { CallbackPage } from "./CallbackPage";

function LoginOutcome() {
  const location = useLocation();
  const error = (location.state as { error?: string } | null)?.error;
  return <p>{error ?? "login"}</p>;
}

function renderCallback() {
  render(
    <MemoryRouter initialEntries={["/auth/callback?code=test-code"]}>
      <Routes>
        <Route path="/auth/callback" element={<CallbackPage />} />
        <Route path="/app/home" element={<p>manager home</p>} />
        <Route path="/login" element={<LoginOutcome />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("CallbackPage", () => {
  it("routes to manager home after a successful PKCE exchange", async () => {
    completeAuthRedirect.mockResolvedValue({ access_token: "token" });
    renderCallback();
    await waitFor(() => expect(screen.getByText("manager home")).toBeInTheDocument());
  });

  it("routes back to login with a safe error", async () => {
    completeAuthRedirect.mockRejectedValue(new Error("Auth code exchange failed."));
    renderCallback();
    await waitFor(() => expect(screen.getByText("Auth code exchange failed.")).toBeInTheDocument());
  });
});
