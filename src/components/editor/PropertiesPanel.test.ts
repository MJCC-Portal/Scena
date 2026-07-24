import { describe, expect, it } from "vitest";
import { normalizeElementConfig } from "./PropertiesPanel";

describe("normalizeElementConfig", () => {
  it("provides useful defaults for every configurable element", () => {
    expect(normalizeElementConfig("clock", undefined)).toEqual({ format: "HH:mm", timezone: "local" });
    expect(normalizeElementConfig("ticker", undefined)).toEqual({ items: [], speed: 40, direction: "left" });
    expect(normalizeElementConfig("video", undefined)).toEqual({ url: "", autoplay: false, muted: true, loop: true });
  });

  it("preserves saved values while filling missing fields", () => {
    expect(normalizeElementConfig("weather", { location: "New York", units: "celsius" })).toEqual({
      location: "New York", latitude: "", longitude: "", units: "celsius", format: "current",
    });
  });

  it("does not mutate the supplied config", () => {
    const config = { target: "2026-07-24T09:00" };
    normalizeElementConfig("countdown", config).format = "hours_minutes_seconds";
    expect(config).toEqual({ target: "2026-07-24T09:00" });
  });
});
