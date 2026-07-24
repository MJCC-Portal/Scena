import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildOpenMeteoUrl, conditionForCode, normalizeOpenMeteo } from "./provider.ts";

Deno.test("builds the documented Open-Meteo current weather request", () => {
  const url = new URL(buildOpenMeteoUrl({ latitude: 40.7128, longitude: -74.006, units: "fahrenheit" }));
  assertEquals(url.pathname, "/v1/forecast");
  assertEquals(url.searchParams.get("latitude"), "40.7128");
  assertEquals(url.searchParams.get("longitude"), "-74.006");
  assertEquals(url.searchParams.get("temperature_unit"), "fahrenheit");
  assertEquals(url.searchParams.get("timezone"), "auto");
  assertStringIncludes(url.searchParams.get("current") ?? "", "temperature_2m");
  assertStringIncludes(url.searchParams.get("current") ?? "", "weather_code");
});

Deno.test("normalizes the provider response for display consumption", () => {
  const result = normalizeOpenMeteo({
    timezone: "America/New_York",
    current: { temperature_2m: 72.5, apparent_temperature: 73, relative_humidity_2m: 58, weather_code: 61, is_day: 1, wind_speed_10m: 8.2, time: "2026-07-23T18:00" },
  }, "fahrenheit");
  assertEquals(result.condition, "Rain");
  assertEquals(result.timezone, "America/New_York");
  assertEquals(result.is_day, true);
  assertEquals(result.units, "fahrenheit");
});

Deno.test("maps documented WMO weather codes", () => {
  assertEquals(conditionForCode(0), "Clear sky");
  assertEquals(conditionForCode(45), "Fog");
  assertEquals(conditionForCode(71), "Snow");
  assertEquals(conditionForCode(95), "Thunderstorm");
  assert(conditionForCode(999) === "Unknown");
});
