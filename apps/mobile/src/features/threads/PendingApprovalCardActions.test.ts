import { describe, expect, it } from "vitest";

import { PENDING_APPROVAL_ACTIONS } from "./PendingApprovalCardActions";

describe("pending approval actions", () => {
  it("keeps the agreed action mapping and safe cancel label", () => {
    expect(PENDING_APPROVAL_ACTIONS).toEqual([
      { key: "proceed", label: "Proceed", decision: "accept" },
      { key: "session", label: "1 · Session", decision: "acceptForSession" },
      { key: "decline", label: "2 · Decline", decision: "decline" },
      { key: "cancel", label: "3 · Cancel request", decision: "cancel" },
    ]);
  });
});
