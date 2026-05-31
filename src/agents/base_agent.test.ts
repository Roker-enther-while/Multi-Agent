import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BaseAgent } from "./base_agent";
import type { AgentInput, AgentRunResult } from "../types/agents";

class TestAgent extends BaseAgent {
  public constructor() {
    super("project_manager");
  }

  public execute(_input: AgentInput): AgentRunResult {
    return {
      agent: this.name,
      status: "completed",
      startedAt: "2026-05-31T00:00:00.000Z",
      endedAt: "2026-05-31T00:00:01.000Z",
      output: {
        report: "# Test Report",
        artifacts: [],
        decisions: [],
        findings: [],
      },
    };
  }
}

describe("BaseAgent", () => {
  it("should return the completed output report", () => {
    const agent = new TestAgent();
    const result = agent.execute({});

    assert.equal(agent.report(result), "# Test Report");
  });

  it("should validate required report content", () => {
    const agent = new TestAgent();

    const validation = agent.validate({
      report: "",
      artifacts: [],
      decisions: [],
      findings: [],
    });

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["Agent output report is required."]);
  });
});
