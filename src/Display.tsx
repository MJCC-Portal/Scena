// Scena kiosk display — the site a screen opens at /#/display.
//
// Boot: get a device token + 6-digit code from the gateway, show the
// code, and poll until a manager claims it. Claimed: poll state every
// few seconds and render the effective scene full-screen. Debug overlay
// (press D, or open with ?debug): FPS, device, network, poll health.

import { useEffect, useRef, useState } from "react";
import { forgetDevice, pairInit, pollState, storedToken, type DisplayState } from "./lib/display";
import { Board } from "./boards";

const POLL_MS = 4000;

export function DisplayApp() {
  const [state, setState] = useState<DisplayState | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pollError, setPollError] = useState(0);
  const [lastPoll, setLastPoll] = useState<{ at: number; ms: number } | null>(null);
  const [debug, setDebug] = useState(() => new URLSearchParams(window.location.search).has("debug"));
  const pairing = useRef(false);

  async function ensurePaired() {
    if (pairing.current) return;
    pairing.current = true;
    try {
      const next = await pairInit();
      setPairCode(next.code);
      setState({ status: "pending" });
    } catch { setPollError((n) => n + 1); }
    finally { pairing.current = false; }
  }

  useEffect(() => {
    let active = true;
    async function tick() {
      if (!storedToken()) { await ensurePaired(); return; }
      const started = performance.now();
      try {
        const next = await pollState();
        if (!active) return;
        setLastPoll({ at: Date.now(), ms: Math.round(performance.now() - started) });
        setPollError(0);
        if (next.status === "unknown_device" || next.status === "pair_expired" || next.status === "revoked") {
          forgetDevice(); setPairCode(null); setState(next); await ensurePaired(); return;
        }
        setState(next);
      } catch { if (active) setPollError((n) => n + 1); }
    }
    tick();
    const iv = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === "d") setDebug((d) => !d); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const offline = pollError >= 3;

  return <div className="display-root">
    {state?.status === "showing"
      ? <Board scene={state.scene} slideshowUrl={state.slideshow_url} />
      : state?.status === "standby"
      ? <div className="display-center">
          <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
          <p className="display-dim">{state.screen_name} · standby — no scene is live</p>
        </div>
      : <div className="display-center">
          <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
          {pairCode ? <>
            <p className="display-dim">Enter this code in the Scena control room to pair this screen</p>
            <div className="pair-code">{pairCode}</div>
            <p className="display-faint">Codes rotate every 10 minutes · this screen stays unpaired until claimed</p>
          </> : <p className="display-dim">Connecting…</p>}
        </div>}
    {offline && <div className="display-offline">Reconnecting…</div>}
    {debug && <DebugOverlay state={state} lastPoll={lastPoll} pollError={pollError} />}
    {!debug && <div className="debug-hint">press D for diagnostics</div>}
  </div>;
}

function DebugOverlay({ state, lastPoll, pollError }: { state: DisplayState | null; lastPoll: { at: number; ms: number } | null; pollError: number }) {
  const [fps, setFps] = useState(0);
  const [now, setNow] = useState(Date.now());
  const bootedAt = useRef(Date.now());

  useEffect(() => {
    let frames = 0, last = performance.now(), raf = 0;
    const loop = (t: number) => {
      frames++;
      if (t - last >= 1000) { setFps(Math.round(frames * 1000 / (t - last))); frames = 0; last = t; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, []);

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number } };
  const token = storedToken();
  const pollAge = lastPoll ? Math.round((now - lastPoll.at) / 1000) : null;
  const uptime = Math.round((now - bootedAt.current) / 1000);
  const rows: Array<[string, string]> = [
    ["fps", String(fps)],
    ["status", state?.status ?? "booting"],
    ["scene", state?.status === "showing" ? `${state.scene.name} (${state.scene.scene_type})` : "—"],
    ["screen", state?.status === "showing" || state?.status === "standby" ? state.screen_name : "unpaired"],
    ["poll", lastPoll ? `${lastPoll.ms}ms · ${pollAge}s ago` : "—"],
    ["poll errors", String(pollError)],
    ["uptime", `${Math.floor(uptime / 60)}m ${uptime % 60}s`],
    ["resolution", `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio}x`],
    ["viewport", `${window.innerWidth}×${window.innerHeight}`],
    ["cpu cores", String(navigator.hardwareConcurrency ?? "?")],
    ["memory", nav.deviceMemory ? `≥${nav.deviceMemory} GB` : "n/a"],
    ["network", nav.connection ? `${nav.connection.effectiveType ?? "?"} · ${nav.connection.downlink ?? "?"} Mbps` : navigator.onLine ? "online" : "offline"],
    ["device token", token ? `…${token.slice(-8)}` : "none"],
    ["user agent", navigator.userAgent.slice(0, 64)],
  ];
  return <div className="debug-overlay">
    <div className="debug-title">SCENA DISPLAY DIAGNOSTICS</div>
    {rows.map(([k, v]) => <div className="debug-row" key={k}><span>{k}</span><b>{v}</b></div>)}
  </div>;
}
