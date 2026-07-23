import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DocsPage } from "./DocsPage";

describe("DocsPage", () => {
  it("explains the setup path, player choices, and plan limits", () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /from first board/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /choose the player that fits your space/i })).toBeInTheDocument();
    expect(screen.getByText("Raspberry Pi player")).toBeInTheDocument();
    expect(screen.getByText("Windows kiosk")).toBeInTheDocument();
    expect(screen.getByText("Smart TV browser")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /personal free/i })).toBeInTheDocument();
    expect(screen.getByText("Version guidance")).toBeInTheDocument();
  });
});
