import { useEffect, useMemo, useState } from "react";
import { ElementBody } from "../components/editor/ElementBody";
import type { SceneElement } from "../services/scena-api/boards";
import type { BoardData, BoardSceneData } from "./resolveDisplayState";

export function BoardRenderer({ board }: { board: BoardData }) {
  const scenes = useMemo(() => board.scenes.filter((scene) => !scene.is_hidden), [board.scenes]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [weatherByElement, setWeatherByElement] = useState<Record<string, Record<string, unknown>>>({});
  const scene = scenes[sceneIndex] ?? scenes[0] ?? null;

  useEffect(() => setSceneIndex(0), [board.id, board.version]);

  useEffect(() => {
    const weatherElements = board.scenes.flatMap((item) => item.elements).filter((element) => element.element_type === "weather");
    const controller = new AbortController();
    let active = true;

    async function refresh() {
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      if (!url) return;
      const results = await Promise.all(weatherElements.map(async (element) => {
        const latitude = numberValue(element.config.latitude);
        const longitude = numberValue(element.config.longitude);
        if (latitude === null || longitude === null) return null;
        try {
          const response = await fetch(`${url}/functions/v1/weather-current`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ latitude, longitude, units: element.config.units === "celsius" ? "celsius" : "fahrenheit" }),
            signal: controller.signal,
          });
          if (!response.ok) return null;
          const payload = await response.json() as { current?: Record<string, unknown> };
          return payload.current ? [element.id, payload.current] as const : null;
        } catch {
          return null;
        }
      }));
      if (!active) return;
      const updates = results.filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry));
      if (updates.length) setWeatherByElement((previous) => ({ ...previous, ...Object.fromEntries(updates) }));
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [board.id, board.version, board.scenes]);

  useEffect(() => {
    if (scenes.length < 2 || !scene) return;
    const timer = window.setTimeout(() => setSceneIndex((index) => (index + 1) % scenes.length), Math.max(1000, scene.duration_ms));
    return () => window.clearTimeout(timer);
  }, [scene, scenes.length]);

  if (!scene) return <div className="display-board" style={{ background: board.background_color }} />;

  return (
    <div
      className="display-board"
      data-board-id={board.id}
      data-session-started-at={board.session_started_at ?? undefined}
      data-session-updated-at={board.session_updated_at}
      style={{ background: backgroundValue(scene, board.background_color) }}
    >
      {scene.elements.filter((element) => element.is_visible).map((element) => (
        <div
          key={element.id}
          className="display-board__element"
          style={{
            left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`,
            transform: `rotate(${element.rotation}deg)`, opacity: element.opacity, zIndex: element.z_index,
          }}
        >
          <ElementBody element={element as SceneElement} runtimeData={weatherByElement[element.id]} />
        </div>
      ))}
    </div>
  );
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function backgroundValue(scene: BoardSceneData, fallback: string): string {
  const value = scene.background?.value;
  return typeof value === "string" && value ? value : fallback;
}
