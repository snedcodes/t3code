import { describe, expect, it } from "vite-plus/test";
import { PORTFOLIO_WORKFLOWS } from "./portfolioWorkflows";

describe("PORTFOLIO_WORKFLOWS", () => {
  it("has stable unique IDs and the operator fields needed for a useful workflow", () => {
    const ids = PORTFOLIO_WORKFLOWS.map((workflow) => workflow.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const workflow of PORTFOLIO_WORKFLOWS) {
      expect(workflow.title).not.toBe("");
      expect(workflow.purpose).not.toBe("");
      expect(workflow.whenToUse).not.toBe("");
      expect(workflow.inputs.length).toBeGreaterThan(0);
      expect(workflow.permittedActions.length).toBeGreaterThan(0);
      expect(workflow.stopConditions.length).toBeGreaterThan(0);
      expect(workflow.evidence.length).toBeGreaterThan(0);
      expect(workflow.source).not.toBe("");
    }
  });
});
