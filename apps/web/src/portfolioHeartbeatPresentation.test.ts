import { describe, expect, it } from "vite-plus/test";
import {
  formatPortfolioHeartbeatCadence,
  formatPortfolioHeartbeatEnvironmentLabel,
  formatPortfolioHeartbeatNextRun,
  formatPortfolioHeartbeatRuns,
} from "./portfolioHeartbeatPresentation";

describe("Portfolio Heartbeat presentation", () => {
  it("uses the native environment label and conservative fallbacks", () => {
    const labels = new Map([["mac", "MacBook Pro"]]);
    expect(formatPortfolioHeartbeatEnvironmentLabel("mac", labels)).toBe("MacBook Pro");
    expect(formatPortfolioHeartbeatEnvironmentLabel("missing", labels)).toBe("Unknown environment");
    expect(formatPortfolioHeartbeatCadence(null)).toBe("Manual cadence");
    expect(formatPortfolioHeartbeatNextRun(null)).toBe("Not scheduled");
  });

  it("summarizes cadence and run limits", () => {
    expect(formatPortfolioHeartbeatCadence(30)).toBe("Every 30 minutes");
    expect(formatPortfolioHeartbeatRuns({ runCount: 2, maxRuns: 5 })).toBe("2/5 runs");
    expect(formatPortfolioHeartbeatRuns({ runCount: 2, maxRuns: null })).toBe("2 runs");
  });
});
