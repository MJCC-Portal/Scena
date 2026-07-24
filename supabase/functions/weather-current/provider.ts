export type WeatherUnits = "celsius" | "fahrenheit";

export type WeatherRequest = {
  latitude: number;
  longitude: number;
  units: WeatherUnits;
};

export type CurrentWeather = {
  temperature: number;
  apparent_temperature: number | null;
  relative_humidity: number | null;
  weather_code: number;
  condition: string;
  is_day: boolean | null;
  wind_speed: number | null;
  time: string;
  timezone: string;
  units: WeatherUnits;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: unknown;
    apparent_temperature?: unknown;
    relative_humidity_2m?: unknown;
    weather_code?: unknown;
    is_day?: unknown;
    wind_speed_10m?: unknown;
    time?: unknown;
  };
  current_units?: Record<string, unknown>;
  timezone?: unknown;
  error?: boolean;
  reason?: unknown;
};

const CURRENT_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "weather_code",
  "is_day",
  "wind_speed_10m",
].join(",");

export function buildOpenMeteoUrl(request: WeatherRequest, baseUrl = "https://api.open-meteo.com/v1/forecast", apiKey?: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", String(request.latitude));
  url.searchParams.set("longitude", String(request.longitude));
  url.searchParams.set("current", CURRENT_VARIABLES);
  url.searchParams.set("temperature_unit", request.units);
  url.searchParams.set("timezone", "auto");
  if (apiKey) url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export async function fetchCurrentWeather(request: WeatherRequest, fetcher: typeof fetch = fetch): Promise<CurrentWeather> {
  const baseUrl = Deno.env.get("OPEN_METEO_BASE_URL")?.trim() || "https://api.open-meteo.com/v1/forecast";
  const apiKey = Deno.env.get("OPEN_METEO_API_KEY")?.trim() || undefined;
  const response = await fetcher(buildOpenMeteoUrl(request, baseUrl, apiKey), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });

  let payload: OpenMeteoResponse = {};
  try { payload = await response.json() as OpenMeteoResponse; } catch { /* handled below */ }
  if (!response.ok || payload.error) throw new Error(typeof payload.reason === "string" ? payload.reason : `weather provider returned ${response.status}`);
  return normalizeOpenMeteo(payload, request.units);
}

export function normalizeOpenMeteo(payload: OpenMeteoResponse, units: WeatherUnits): CurrentWeather {
  const current = payload.current;
  const temperature = finiteNumber(current?.temperature_2m);
  const weatherCode = integer(current?.weather_code);
  const time = typeof current?.time === "string" ? current.time : "";
  const timezone = typeof payload.timezone === "string" ? payload.timezone : "GMT";
  if (temperature === null || weatherCode === null || !time) throw new Error("weather provider returned an incomplete current observation");

  return {
    temperature,
    apparent_temperature: finiteNumber(current?.apparent_temperature),
    relative_humidity: finiteNumber(current?.relative_humidity_2m),
    weather_code: weatherCode,
    condition: conditionForCode(weatherCode),
    is_day: current?.is_day === 0 || current?.is_day === 1 ? current.is_day === 1 : null,
    wind_speed: finiteNumber(current?.wind_speed_10m),
    time,
    timezone,
    units,
  };
}

export function conditionForCode(code: number): string {
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Unknown";
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}
