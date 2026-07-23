import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { convertLegacyKioskHash } from "./app/legacyKioskRedirect";
import { ToastProvider } from "./components/ui/Toast";
import "./styles.css";

// Legacy kiosk compatibility: a kiosk that opened Scena before this
// routing pass may still be pointed at `#/display`. Convert it to the
// real browser route before the router mounts, using replaceState so it
// doesn't add a spurious history entry.
const legacyPath = convertLegacyKioskHash(window.location.hash);
if (legacyPath) window.history.replaceState(null, "", legacyPath);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
