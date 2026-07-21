import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

const mockReadCachedDisplayState = vi.fn();
vi.mock("../lib/display", () => ({ readCachedDisplayState: () => mockReadCachedDisplayState() }));

async function renderBoundary() {
  const { DisplayErrorBoundary } = await import("./DisplayErrorBoundary");
  const Thrower = () => { throw new Error("simulated kiosk render failure"); };
  const router = createMemoryRouter(
    [{ path: "/", element: <Thrower />, errorElement: <DisplayErrorBoundary /> }],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("DisplayErrorBoundary", () => {
  it("restores the last cached showing state instead of a blank screen", async () => {
    mockReadCachedDisplayState.mockReturnValue({ status: "showing" });
    await renderBoundary();
    expect(screen.getByText(/Showing last known content/)).toBeInTheDocument();
  });

  it("falls back to a reconnecting message when there is no cache", async () => {
    mockReadCachedDisplayState.mockReturnValue(null);
    await renderBoundary();
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
  });
});
