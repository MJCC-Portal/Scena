// Reusable unsaved-change protection for future editor routes
// (menus/:menuId/edit, layouts/:layoutId/edit, etc.) — prepared now per
// this routing pass's scope, not wired to any editor's save behavior yet,
// since no editor exists yet (see docs/api-inventory.json — editor UI is
// future manager-UI-phase work).
//
// react-router-dom v7's useBlocker requires a data router (this app uses
// createBrowserRouter, so it's available). A future editor calls this
// with a boolean "is there something unsaved" and gets back the blocker
// state to render a confirm-navigation prompt.

import { useBlocker } from "react-router-dom";

export function useUnsavedChangesBlocker(hasUnsavedChanges: boolean) {
  return useBlocker(({ currentLocation, nextLocation }) => hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname);
}
