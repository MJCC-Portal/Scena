import { serveJson, json } from "../_shared/http.ts";
import { ApiError } from "../_shared/errors.ts";
import { fetchCurrentWeather, type WeatherRequest, type WeatherUnits } from "./provider.ts";

const CACHE_CONTROL = "public, max-age=60, s-maxage=120, stale-while-revalidate=300";
const CACHE_LIMIT = 128;
const cache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof fetchCurrentWeather>> }>();

serveJson(async (req) => {
  const body = await req.json() as Record<string, unknown>;
  const request = parseRequest(body);
  const key = `${request.latitude.toFixed(4)}:${request.longitude.toFixed(4)}:${request.units}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return weatherResponse(cached.value, true);
  if (cached) cache.delete(key);

  let weather;
  try {
    weather = await fetchCurrentWeather(request);
  } catch (cause) {
    console.error("weather provider request failed", cause instanceof Error ? cause.message : "unknown error");
    throw ApiError.internal("Weather data is temporarily unavailable.");
  }

  cache.set(key, { expiresAt: Date.now() + 60_000, value: weather });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return weatherResponse(weather, false);
}, ["POST"]);

function parseRequest(body: Record<string, unknown>): WeatherRequest {
  const latitude = number(body.latitude);
  const longitude = number(body.longitude);
  const units = body.units === "fahrenheit" ? "fahrenheit" : body.units === "celsius" || body.units === undefined ? "celsius" : null;
  if (latitude === null || latitude < -90 || latitude > 90) throw ApiError.validation("latitude must be between -90 and 90.");
  if (longitude === null || longitude < -180 || longitude > 180) throw ApiError.validation("longitude must be between -180 and 180.");
  if (!units) throw ApiError.validation("units must be celsius or fahrenheit.");
  return { latitude, longitude, units: units as WeatherUnits };
}

function weatherResponse(weather: Awaited<ReturnType<typeof fetchCurrentWeather>>, cacheHit: boolean): Response {
  const response = json({ provider: "open-meteo", current: weather, cached: cacheHit });
  response.headers.set("cache-control", CACHE_CONTROL);
  response.headers.set("x-scena-weather-cache", cacheHit ? "hit" : "miss");
  return response;
}

function number(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}
