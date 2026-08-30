import { assert, describe, it } from "@effect/vitest";

import type { PortfolioHeartbeatRecord } from "@t3tools/contracts";
import {
  buildPortfolioHeartbeatPrompt,
  isLocalHeartbeatTarget,
} from "./PortfolioHeartbeatScheduler.ts";

const record = (environmentId: string) =>
  ({ target: { environmentId } }) as PortfolioHeartbeatRecord;

describe("PortfolioHeartbeatScheduler target routing", () => {
  it("does not treat a remote target as VPS-local", () => {
    assert.equal(isLocalHeartbeatTarget(record("mac-alpha"), "vps-dev"), false);
    assert.equal(isLocalHeartbeatTarget(record("vps-dev"), "vps-dev"), true);
  });

  it("uses a saved custom message and otherwise keeps the standalone fallback", () => {
    assert.equal(
      buildPortfolioHeartbeatPrompt(
        {
          ...record("vps-dev"),
          heartbeatId: "heartbeat-1",
          message: "Inspect the build and continue until complete.",
        },
        null,
      ),
      "Inspect the build and continue until complete.",
    );
    assert.match(
      buildPortfolioHeartbeatPrompt({ ...record("vps-dev"), heartbeatId: "heartbeat-1" }, null),
      /standalone Heartbeat "heartbeat-1"/,
    );
  });
});
