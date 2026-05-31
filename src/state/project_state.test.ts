/**
 * Tests for project_state.ts
 *
 * Verifies all state manipulation functions work correctly.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createInitialProjectState,
  addArtifact,
  addDecision,
  addVerificationResult,
  addBlocker,
  completeStep,
  setNextStep,
  setWorkflowStatus,
  addStep,
  setScopeLock,
  resolveBlocker,
  getCurrentStep,
  getArtifactsByType,
} from "./project_state";

import type { ArtifactRef } from "../types/artifacts";
import type { VerificationResult } from "../types/workflow";

// ---------------------------------------------------------------------------
// createInitialProjectState
// ---------------------------------------------------------------------------

describe("createInitialProjectState", () => {
  it("should create state from a string requirement", () => {
    const state = createInitialProjectState("Add login feature");

    assert.equal(state.requirement, "Add login feature");
    assert.equal(state.status, "initialized");
    assert.ok(state.runId);
    assert.ok(state.createdAt);
    assert.deepEqual(state.steps, []);
    assert.deepEqual(state.artifacts, []);
    assert.deepEqual(state.blockers, []);
    assert.deepEqual(state.decisions, []);
    assert.deepEqual(state.verificationResults, []);
  });

  it("should create state from a config object", () => {
    const state = createInitialProjectState({
      requirement: "Fix bug #123",
      runId: "test-run-001",
    });

    assert.equal(state.requirement, "Fix bug #123");
    assert.equal(state.runId, "test-run-001");
    assert.equal(state.status, "initialized");
  });

  it("should generate a runId if not provided in config", () => {
    const state = createInitialProjectState({ requirement: "Test" });

    assert.ok(state.runId);
    assert.ok(state.runId.length > 0);
  });
});

// ---------------------------------------------------------------------------
// addArtifact
// ---------------------------------------------------------------------------

describe("addArtifact", () => {
  it("should add an artifact to the state", () => {
    const state = createInitialProjectState("Test");
    const artifact: ArtifactRef = {
      id: "art-001",
      type: "context_pack",
      path: "/runs/test/context-pack.md",
      createdAt: new Date().toISOString(),
      producedBy: "context_reader",
    };

    const newState = addArtifact(state, artifact);

    assert.equal(newState.artifacts.length, 1);
    assert.equal(newState.artifacts[0].id, "art-001");
    assert.equal(newState.artifacts[0].type, "context_pack");
  });

  it("should not mutate the original state", () => {
    const state = createInitialProjectState("Test");
    const artifact: ArtifactRef = {
      id: "art-001",
      type: "context_pack",
      path: "/test.md",
      createdAt: new Date().toISOString(),
      producedBy: "context_reader",
    };

    addArtifact(state, artifact);

    assert.equal(state.artifacts.length, 0);
  });
});

// ---------------------------------------------------------------------------
// addDecision
// ---------------------------------------------------------------------------

describe("addDecision", () => {
  it("should add a decision with auto-generated id and timestamp", () => {
    const state = createInitialProjectState("Test");

    const newState = addDecision(state, {
      madeBy: "senior_layer",
      decision: "Use REST API",
      rationale: "Simpler than GraphQL for this use case",
    });

    assert.equal(newState.decisions.length, 1);
    assert.ok(newState.decisions[0].id);
    assert.ok(newState.decisions[0].madeAt);
    assert.equal(newState.decisions[0].decision, "Use REST API");
  });

  it("should use provided id and timestamp", () => {
    const state = createInitialProjectState("Test");
    const fixedTime = "2026-01-01T00:00:00Z";

    const newState = addDecision(state, {
      id: "dec-001",
      madeBy: "project_manager",
      decision: "Proceed",
      rationale: "All clear",
      madeAt: fixedTime,
    });

    assert.equal(newState.decisions[0].id, "dec-001");
    assert.equal(newState.decisions[0].madeAt, fixedTime);
  });
});

// ---------------------------------------------------------------------------
// addVerificationResult
// ---------------------------------------------------------------------------

describe("addVerificationResult", () => {
  it("should add a verification result", () => {
    const state = createInitialProjectState("Test");
    const result: VerificationResult = {
      command: "npm test",
      passed: true,
      exitCode: 0,
      stdout: "All tests passed",
      stderr: "",
      runAt: new Date().toISOString(),
      durationMs: 1500,
    };

    const newState = addVerificationResult(state, result);

    assert.equal(newState.verificationResults.length, 1);
    assert.equal(newState.verificationResults[0].command, "npm test");
    assert.equal(newState.verificationResults[0].passed, true);
  });
});

// ---------------------------------------------------------------------------
// addBlocker
// ---------------------------------------------------------------------------

describe("addBlocker", () => {
  it("should add a blocker and set status to blocked", () => {
    const state = createInitialProjectState("Test");

    const newState = addBlocker(state, {
      stepId: "step-001",
      reportedBy: "test_runner_debugger",
      reason: "Database connection failed",
    });

    assert.equal(newState.status, "blocked");
    assert.equal(newState.blockers.length, 1);
    assert.ok(newState.blockers[0].id);
    assert.ok(newState.blockers[0].reportedAt);
    assert.equal(newState.blockers[0].resolved, false);
    assert.equal(newState.blockers[0].reason, "Database connection failed");
  });
});

// ---------------------------------------------------------------------------
// completeStep
// ---------------------------------------------------------------------------

describe("completeStep", () => {
  it("should mark a step as completed", () => {
    let state = createInitialProjectState("Test");
    state = addStep(state, {
      id: "step-001",
      agent: "context_reader",
      phase: "context_reading",
      description: "Read repo context",
      expectedOutputs: ["context_pack"],
      dependencies: [],
    });

    const newState = completeStep(state, "step-001");

    const step = newState.steps.find((s) => s.id === "step-001");
    assert.equal(step?.status, "completed");
    assert.ok(step?.endedAt);
  });

  it("should attach outputs when completing a step", () => {
    let state = createInitialProjectState("Test");
    state = addStep(state, {
      id: "step-001",
      agent: "context_reader",
      phase: "context_reading",
      description: "Read repo context",
      expectedOutputs: ["context_pack"],
      dependencies: [],
    });

    const outputs: ArtifactRef[] = [
      {
        id: "art-001",
        type: "context_pack",
        path: "/test.md",
        createdAt: new Date().toISOString(),
        producedBy: "context_reader",
      },
    ];

    const newState = completeStep(state, "step-001", outputs);

    const step = newState.steps.find((s) => s.id === "step-001");
    assert.equal(step?.outputs.length, 1);
    assert.equal(step?.outputs[0].id, "art-001");
  });
});

// ---------------------------------------------------------------------------
// setNextStep
// ---------------------------------------------------------------------------

describe("setNextStep", () => {
  it("should update the nextStep field", () => {
    const state = createInitialProjectState("Test");

    const newState = setNextStep(state, "Run planner agent");

    assert.equal(newState.nextStep, "Run planner agent");
  });
});

// ---------------------------------------------------------------------------
// setWorkflowStatus
// ---------------------------------------------------------------------------

describe("setWorkflowStatus", () => {
  it("should set startedAt when moving to running", () => {
    const state = createInitialProjectState("Test");

    const newState = setWorkflowStatus(state, "running");

    assert.equal(newState.status, "running");
    assert.ok(newState.startedAt);
  });

  it("should set endedAt when moving to completed", () => {
    const state = createInitialProjectState("Test");

    const newState = setWorkflowStatus(state, "completed");

    assert.equal(newState.status, "completed");
    assert.ok(newState.endedAt);
  });

  it("should set endedAt when moving to failed", () => {
    const state = createInitialProjectState("Test");

    const newState = setWorkflowStatus(state, "failed");

    assert.equal(newState.status, "failed");
    assert.ok(newState.endedAt);
  });
});

// ---------------------------------------------------------------------------
// resolveBlocker
// ---------------------------------------------------------------------------

describe("resolveBlocker", () => {
  it("should mark a blocker as resolved", () => {
    let state = createInitialProjectState("Test");
    state = addBlocker(state, {
      id: "block-001",
      stepId: "step-001",
      reportedBy: "test_runner_debugger",
      reason: "Missing dependency",
    });

    const newState = resolveBlocker(state, "block-001");

    const blocker = newState.blockers.find((b) => b.id === "block-001");
    assert.equal(blocker?.resolved, true);
    assert.ok(blocker?.resolvedAt);
  });

  it("should change status to running when all blockers resolved", () => {
    let state = createInitialProjectState("Test");
    state = addBlocker(state, {
      id: "block-001",
      stepId: "step-001",
      reportedBy: "test_runner_debugger",
      reason: "Missing dependency",
    });

    assert.equal(state.status, "blocked");

    const newState = resolveBlocker(state, "block-001");

    assert.equal(newState.status, "running");
  });
});

// ---------------------------------------------------------------------------
// getCurrentStep
// ---------------------------------------------------------------------------

describe("getCurrentStep", () => {
  it("should return undefined when no steps exist", () => {
    const state = createInitialProjectState("Test");

    assert.equal(getCurrentStep(state), undefined);
  });

  it("should return the running step", () => {
    let state = createInitialProjectState("Test");
    state = addStep(state, {
      id: "step-001",
      agent: "context_reader",
      phase: "context_reading",
      description: "Read context",
      expectedOutputs: ["context_pack"],
      dependencies: [],
      status: "running",
    });

    const current = getCurrentStep(state);
    assert.equal(current?.id, "step-001");
  });
});

// ---------------------------------------------------------------------------
// getArtifactsByType
// ---------------------------------------------------------------------------

describe("getArtifactsByType", () => {
  it("should filter artifacts by type", () => {
    let state = createInitialProjectState("Test");
    state = addArtifact(state, {
      id: "art-001",
      type: "context_pack",
      path: "/cp.md",
      createdAt: new Date().toISOString(),
      producedBy: "context_reader",
    });
    state = addArtifact(state, {
      id: "art-002",
      type: "task_plan",
      path: "/tp.md",
      createdAt: new Date().toISOString(),
      producedBy: "planner",
    });
    state = addArtifact(state, {
      id: "art-003",
      type: "context_pack",
      path: "/cp2.md",
      createdAt: new Date().toISOString(),
      producedBy: "context_reader",
    });

    const contextPacks = getArtifactsByType(state, "context_pack");
    assert.equal(contextPacks.length, 2);
    assert.equal(contextPacks[0].id, "art-001");
    assert.equal(contextPacks[1].id, "art-003");
  });
});
