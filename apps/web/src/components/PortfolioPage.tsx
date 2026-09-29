import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  PortfolioModeSidebar,
  PortfolioModeTopBar,
  PortfolioModeView,
  type PortfolioDestination,
  type PortfolioMode,
} from "./PortfolioModeNavigation";

export function PortfolioPage() {
  const navigate = useNavigate();
  const [mode, setModeState] = useState<PortfolioMode>("portfolio");
  const [destination, setDestination] = useState<PortfolioDestination>("heartbeats");
  const setMode = useCallback<Dispatch<SetStateAction<PortfolioMode>>>(
    (next) => {
      const nextMode = typeof next === "function" ? next(mode) : next;
      if (nextMode === null) {
        void navigate({ to: "/" });
        return;
      }
      setModeState(nextMode);
    },
    [mode, navigate],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <PortfolioModeSidebar
          mode="portfolio"
          setMode={setMode}
          destination={destination}
          setDestination={setDestination}
        />
      </aside>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <PortfolioModeTopBar mode={mode} setMode={setMode} />
        <PortfolioModeView destination={destination} setMode={setMode} />
      </div>
    </div>
  );
}
