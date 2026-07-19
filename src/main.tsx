import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { DisplayApp } from "./Display";
import "./styles.css";

// The kiosk surface lives at /#/display so the static host needs no
// rewrite rules; everything else is the manager portal. (SSO callbacks
// use #code=..., which never matches the display route.)
const isDisplay = window.location.hash.startsWith("#/display");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isDisplay ? <DisplayApp /> : <App />}</StrictMode>,
);
