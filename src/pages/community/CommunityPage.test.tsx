import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CommunityPage } from "./CommunityPage";

describe("CommunityPage", () => {
  it("shows public starter conversations and the participation boundary", () => {
    render(
      <MemoryRouter>
        <CommunityPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /ask the people doing it/i })).toBeInTheDocument();
    expect(screen.getByText(/Read without signing in/i)).toBeInTheDocument();
    expect(screen.getAllByText("How do I keep a Raspberry Pi display running after a power loss?")).toHaveLength(2);
    expect(screen.getByText("What resolution should I use for a lobby TV?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ask a question/i })).toBeInTheDocument();
  });
});
