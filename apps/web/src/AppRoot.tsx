import { RouterProvider } from "@tanstack/react-router";

import { ElectronBrowserHost } from "./browser/ElectronBrowserHost";
import { PreviewAutomationHosts } from "./components/preview/PreviewAutomationHosts";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";
import { usePrimaryEnvironmentId } from "./state/environments";
import { usePortfolioHeartbeatRemoteDispatcher } from "./state/portfolio";
import type { AppRouter } from "./router";

function AppRuntimeShell({ router }: { readonly router: AppRouter }) {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  usePortfolioHeartbeatRemoteDispatcher(primaryEnvironmentId);

  return (
    <>
      <RouterProvider router={router} />
      <PreviewAutomationHosts />
      <ElectronBrowserHost />
    </>
  );
}

/**
 * Owns renderer-wide providers. The Electron browser host intentionally sits
 * outside the router so its webviews survive route transitions, but it must
 * share the same atom registry as routed UI.
 */
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <AppAtomRegistryProvider>
      <AppRuntimeShell router={router} />
    </AppAtomRegistryProvider>
  );
}
