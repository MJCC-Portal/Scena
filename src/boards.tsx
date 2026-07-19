// Board renderers shared by the control-room monitor and the kiosk
// display, so what a manager previews is exactly what a screen shows.

import type { Scene, SceneConfig } from "./lib/scenes";

export const sceneTypeLabels: Record<Scene["scene_type"], string> = {
  menu: "Menu board", queue: "Queue", slideshow: "Slideshow", media: "Media", layout: "Layout",
};

export function Board({ scene, serving = 41, slideshowUrl }: { scene: Pick<Scene, "name" | "scene_type" | "config"> | null; serving?: number; slideshowUrl?: string }) {
  if (!scene) return <div className="slide-board">Create a scene to light this board up</div>;
  const config: SceneConfig = scene.config ?? {};
  if (scene.scene_type === "menu") {
    const items = config.items ?? [];
    const half = Math.ceil(items.length / 2);
    const col = (part: string[]) => <div>{part.map((item, i) => {
      const [name, price] = item.split("·").map((p) => p.trim());
      return <div className="mi" key={i}><span>{name}</span>{price && <span>{price}</span>}</div>;
    })}</div>;
    return <div className="board"><div className="b-head">{(config.title ?? scene.name).toUpperCase()}</div>
      <div className="menu-cols">{col(items.slice(0, half))}{col(items.slice(half))}</div></div>;
  }
  if (scene.scene_type === "queue") return <div className="queue-board"><div className="lbl">Now serving</div>
    <div className="num">{String(serving).padStart(3, "0")}</div>
    <div className="nxt">next · {[1, 2, 3].map((k) => String(serving + k).padStart(3, "0")).join(" · ")}</div></div>;
  if (scene.scene_type === "slideshow") {
    if (slideshowUrl) return <iframe className="deck-frame" title={scene.name}
      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(slideshowUrl)}`} allowFullScreen />;
    return <div className="slide-board">{scene.name} — slideshow</div>;
  }
  return <div className="slide-board">{scene.name} — {sceneTypeLabels[scene.scene_type]} scene</div>;
}
