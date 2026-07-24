import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardRenderer } from "./BoardRenderer";
import type { BoardData } from "./resolveDisplayState";

const board: BoardData = {
  id: "board-1",
  workspace_id: "workspace-1",
  name: "Welcome Board",
  canvas_width: 1920,
  canvas_height: 1080,
  background_color: "#000000",
  status: "active",
  version: 3,
  updated_at: "2026-07-23T20:00:00.000Z",
  session_started_at: "2026-07-23T20:01:00.000Z",
  session_updated_at: "2026-07-23T20:02:00.000Z",
  location_timezone: "America/New_York",
  scenes: [{
    id: "scene-1",
    name: "Welcome",
    sort_order: 0,
    duration_ms: 10_000,
    transition_type: "fade",
    transition_config: {},
    background: { type: "color", value: "#112233" },
    is_hidden: false,
    elements: [{
      id: "element-1",
      element_type: "text",
      render_mode: "static",
      name: "Greeting",
      x: 10,
      y: 10,
      width: 80,
      height: 20,
      rotation: 0,
      opacity: 1,
      z_index: 1,
      is_locked: false,
      is_visible: true,
      asset_id: null,
      asset_page_id: null,
      config: { text: "Live Board content" },
    }],
  }],
};

describe("BoardRenderer", () => {
  it("renders Board scene elements and carries session timestamps", () => {
    render(<BoardRenderer board={board} />);
    expect(screen.getByText("Live Board content")).toBeTruthy();
    expect(document.querySelector('[data-board-id="board-1"]')?.getAttribute("data-session-started-at")).toBe(board.session_started_at);
    expect(document.querySelector('[data-board-id="board-1"]')?.getAttribute("data-session-updated-at")).toBe(board.session_updated_at);
  });
});
