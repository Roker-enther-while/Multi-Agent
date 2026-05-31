import { BaseAgent } from "./base_agent";
import type {
  AgentDecision,
  AgentFinding,
  AgentInput,
  AgentName,
  AgentOutput,
  AgentRunResult,
} from "../types/agents";
import type { VerificationResult } from "../types/workflow";
import { buildSeniorValueAssessment, renderSeniorValueAssessment, type SeniorValueAssessment } from "../tools/senior_value_gates";

interface RequirementAnalysis {
  raw: string;
  type: "endpoint" | "validation" | "response_change" | "error_handling" | "docs" | "cli_option" | "config" | "test" | "report" | "bug_fix" | "general";
  subject: string;
  endpoints: string[];
  fields: string[];
  files: string[];
  actions: string[];
  constraints: string[];
}

function analyzeRequirement(requirement: string): RequirementAnalysis {
  const lower = requirement.toLowerCase();
  const raw = requirement;

  let type: RequirementAnalysis["type"] = "general";
  if (/add.*(endpoint|route|api|get|post|put|delete|patch)/i.test(requirement)) type = "endpoint";
  else if (/add.*valid/i.test(requirement)) type = "validation";
  else if (/change|rename|update.*response|field/i.test(requirement)) type = "response_change";
  else if (/error|exception|catch|retry|graceful/i.test(requirement)) type = "error_handling";
  else if (/update.*doc|documentation|readme|api\.md/i.test(requirement)) type = "docs";
  else if (/add.*option|flag|cli.*arg/i.test(requirement)) type = "cli_option";
  else if (/config|yaml|setting|hybrid.*mode/i.test(requirement)) type = "config";
  else if (/test|unit test|test case|spec/i.test(requirement)) type = "test";
  else if (/update.*report|metric|histogram|export/i.test(requirement)) type = "report";
  else if (/fix|bug|broken|incorrect/i.test(requirement)) type = "bug_fix";

  const endpointPattern = /(?:GET|POST|PUT|DELETE|PATCH)\s+[\/\w{}\-]+/gi;
  const endpoints = (requirement.match(endpointPattern) ?? []).map((e) => e.trim());

  const fieldPattern = /['"](\w+)['"]/g;
  const fields: string[] = [];
  let fieldMatch: RegExpExecArray | null;
  while ((fieldMatch = fieldPattern.exec(requirement)) !== null) {
    if (!fields.includes(fieldMatch[1])) fields.push(fieldMatch[1]);
  }

  const filePattern = /[\w\/]+\.(?:ts|py|md|yaml|json|yml|js|tsx|jsx)/g;
  const files = (requirement.match(filePattern) ?? []);

  const actionVerbs = ["add", "create", "update", "change", "rename", "fix", "remove", "delete", "implement", "validate", "return", "log", "catch"];
  const actions = actionVerbs.filter((verb) => lower.includes(verb));

  const constraintPattern = /(?:must|should|shall|return|include|support|default)\s+[^.]+/gi;
  const constraints = (requirement.match(constraintPattern) ?? []).map((c) => c.trim());

  const subjectMatch = requirement.match(/(?:add|create|update|change|rename|fix)\s+(.+?)(?:\.|$)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : requirement.slice(0, 80);

  return { raw, type, subject, endpoints, fields, files, actions, constraints };
}

function completedResult(
  agent: AgentName,
  report: string,
  decisions: AgentDecision[] = [],
  findings: AgentFinding[] = []
): AgentRunResult {
  const startedAt = new Date().toISOString();

  const output: AgentOutput = {
    report,
    artifacts: [],
    decisions,
    findings,
  };

  return {
    agent,
    status: "completed",
    startedAt,
    endedAt: new Date().toISOString(),
    output,
  };
}

function requireText(input: AgentInput, field: "requirement"): string {
  const value = input[field];
  if (!value?.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value;
}

export class MockContextReaderAgent extends BaseAgent {
  public constructor() {
    super("context_reader");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");
    const files = input.extra?.codeSummary && typeof input.extra.codeSummary === "object"
      ? JSON.stringify(input.extra.codeSummary, null, 2)
      : "No code summary provided.";

    return completedResult(
      this.name,
      [
        "# Context Pack",
        "",
        "## Requirement",
        requirement,
        "",
        "## Repository Context",
        "```json",
        files,
        "```",
      ].join("\n")
    );
  }
}

export class MockPlannerAgent extends BaseAgent {
  public constructor() {
    super("planner");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");
    const analysis = analyzeRequirement(requirement);
    const steps = generateTaskSteps(analysis);

    return completedResult(
      this.name,
      [
        "# Task Plan",
        "",
        `Requirement: ${requirement}`,
        "",
        "## Steps",
        ...steps,
        "",
        "## References",
        `Context Pack: ${input.contextPackPath ?? "missing"}`,
        `BA Package: ${input.extra?.baRequirementPackagePath ?? "missing"}`,
        `Visual Model: ${input.extra?.visualModelPackagePath ?? "missing"}`,
      ].join("\n"),
      [
        {
          decision: "Use sequential deterministic execution.",
          rationale: "Phase 2 excludes parallel execution and real LLM calls.",
          alternatives: ["Parallel agent execution", "Real LLM orchestration"],
          risk: "low",
        },
      ]
    );
  }
}

function generateTaskSteps(analysis: RequirementAnalysis): string[] {
  const steps: string[] = [];
  switch (analysis.type) {
    case "endpoint":
      steps.push(
        `1. Identify target file for the new endpoint${analysis.files.length > 0 ? ` (${analysis.files.join(", ")})` : ""}.`,
        `2. Implement ${analysis.endpoints.length > 0 ? analysis.endpoints.join(", ") : "the endpoint"} with request handling.`,
        `3. Add response schema with required fields${analysis.fields.length > 0 ? `: ${analysis.fields.join(", ")}` : ""}.`,
        "4. Add error handling for invalid input and not-found cases.",
        "5. Write tests for success and error paths.",
        "6. Update API documentation."
      );
      break;
    case "validation":
      steps.push(
        "1. Identify the endpoint or function to add validation to.",
        `2. Implement validation rules${analysis.constraints.length > 0 ? `: ${analysis.constraints.slice(0, 3).join("; ")}` : ""}.`,
        "3. Add error responses for validation failures.",
        "4. Write tests for valid and invalid inputs.",
        "5. Update documentation with validation rules."
      );
      break;
    case "bug_fix":
      steps.push(
        "1. Locate the buggy code based on the requirement description.",
        "2. Understand the root cause of the bug.",
        "3. Implement the fix.",
        "4. Write a regression test that reproduces the bug.",
        "5. Verify the fix passes the regression test.",
        "6. Review for similar patterns elsewhere in the codebase."
      );
      break;
    case "error_handling":
      steps.push(
        "1. Identify error-prone code paths in the affected area.",
        "2. Implement structured error handling with specific error types.",
        "3. Add appropriate HTTP status codes and error response bodies.",
        "4. Add logging with correlation IDs for traceability.",
        "5. Write tests for error scenarios.",
        "6. Verify graceful degradation."
      );
      break;
    case "test":
      steps.push(
        "1. Identify the target class or module to test.",
        "2. Set up test fixtures and mock dependencies.",
        `3. Write test cases for: ${analysis.subject}.`,
        "4. Ensure tests cover both happy path and error paths.",
        "5. Run the test suite and verify all tests pass.",
        "6. Review test coverage and add missing cases."
      );
      break;
    default:
      steps.push(
        `1. Analyze requirement: "${analysis.subject}".`,
        `2. Identify affected files${analysis.files.length > 0 ? `: ${analysis.files.join(", ")}` : " from context"}.`,
        "3. Implement changes.",
        "4. Write tests.",
        "5. Verify and review."
      );
  }
  return steps;
}

export class MockBAArtifactAgent extends BaseAgent {
  public constructor() {
    super("ba_artifact");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");
    const analysis = analyzeRequirement(requirement);

    const userStories = generateUserStories(analysis);
    const acceptanceCriteria = generateAcceptanceCriteria(analysis);
    const apiDraft = generateApiDraft(analysis);
    const dataDraft = generateDataDraft(analysis);

    return completedResult(
      this.name,
      [
        "# BA Requirement Package",
        "",
        "## Requirement Summary",
        requirement,
        "",
        "## User Stories",
        ...userStories,
        "",
        "## Acceptance Criteria",
        ...acceptanceCriteria,
        "",
        "## Flow",
        `1. Understand requirement: "${analysis.subject}"`,
        `2. Identify affected components: ${analysis.files.length > 0 ? analysis.files.join(", ") : "determine from context"}`,
        "3. Implement changes with tests.",
        "4. Verify and review.",
        "",
        "## API Draft",
        ...apiDraft,
        "",
        "## Data Draft",
        ...dataDraft,
        "",
        "## UI Draft",
        "- CLI prints status and artifact paths.",
        "- HTML/reporting phases can render the same artifact chain for human review.",
      ].join("\n")
    );
  }
}

function generateUserStories(analysis: RequirementAnalysis): string[] {
  const stories: string[] = [];
  switch (analysis.type) {
    case "endpoint":
      stories.push(
        `- As a client developer, I want ${analysis.subject} so that I can retrieve the required data through the API.`,
        `- As a backend developer, I want to implement the endpoint with proper error handling so that clients get predictable responses.`
      );
      break;
    case "validation":
      stories.push(
        `- As a user, I want input validation on ${analysis.subject} so that I get clear error messages for invalid input.`,
        `- As a developer, I want validation rules enforced at the API boundary so that invalid data never reaches business logic.`
      );
      break;
    case "response_change":
      stories.push(
        `- As a client developer, I want the updated response format so that I can use the new fields in my application.`,
        `- As a developer, I want backward-compatible changes so that existing clients are not broken.`
      );
      break;
    case "error_handling":
      stories.push(
        `- As a user, I want graceful error handling so that I get meaningful error messages instead of crashes.`,
        `- As an operator, I want structured error logs with correlation IDs so that I can trace issues across services.`
      );
      break;
    case "bug_fix":
      stories.push(
        `- As a user, I want the bug fixed so that the feature works correctly.`,
        `- As a developer, I want a regression test so that the bug does not reoccur.`
      );
      break;
    case "test":
      stories.push(
        `- As a developer, I want comprehensive tests for ${analysis.subject} so that I can verify correctness and catch regressions.`,
        `- As a reviewer, I want test coverage evidence so that I can assess code quality.`
      );
      break;
    default:
      stories.push(
        `- As a user, I want ${analysis.subject} so that the system meets the stated requirement.`,
        `- As a reviewer, I want acceptance evidence so that I can validate completion quickly.`
      );
  }
  return stories;
}

function generateAcceptanceCriteria(analysis: RequirementAnalysis): string[] {
  const criteria: string[] = [];
  if (analysis.endpoints.length > 0) {
    criteria.push(`- Given the endpoint exists, when a client sends a request, then the response matches the expected schema.`);
    criteria.push(`- Given invalid input, when a client sends a request, then the endpoint returns an appropriate error status.`);
  }
  if (analysis.fields.length > 0) {
    criteria.push(`- Given the change is applied, when inspecting the output, then the fields [${analysis.fields.join(", ")}] are present and correctly formatted.`);
  }
  if (analysis.constraints.length > 0) {
    for (const constraint of analysis.constraints.slice(0, 3)) {
      criteria.push(`- Given the implementation, when testing, then ${constraint.toLowerCase()}.`);
    }
  }
  if (criteria.length === 0) {
    criteria.push(
      `- Given the requirement, when the workflow runs, then all required artifacts are generated.`,
      `- Given verification runs, when any command fails, then the workflow reports a blocker.`
    );
  }
  return criteria;
}

function generateApiDraft(analysis: RequirementAnalysis): string[] {
  if (analysis.endpoints.length > 0) {
    return analysis.endpoints.map((ep) => `- \`${ep}\` — ${analysis.subject}`);
  }
  if (analysis.type === "cli_option") {
    return [`- CLI option: ${analysis.subject}`];
  }
  if (analysis.type === "config") {
    return [`- Configuration: ${analysis.subject}`];
  }
  return [`- Affected component: ${analysis.subject}`];
}

function generateDataDraft(analysis: RequirementAnalysis): string[] {
  const lines: string[] = [];
  if (analysis.fields.length > 0) {
    lines.push(`- Fields involved: ${analysis.fields.join(", ")}`);
  }
  if (analysis.constraints.length > 0) {
    lines.push(`- Constraints: ${analysis.constraints.slice(0, 3).join("; ")}`);
  }
  if (lines.length === 0) {
    lines.push(`- Data changes: ${analysis.subject}`);
  }
  return lines;
}

export class MockVisualModelingAgent extends BaseAgent {
  public constructor() {
    super("visual_modeling");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");
    const analysis = analyzeRequirement(requirement);
    const diagrams = generateDiagrams(analysis);

    return completedResult(
      this.name,
      [
        "# Visual Model Package",
        "",
        `Requirement: ${requirement}`,
        "",
        ...diagrams,
        "",
        `Context Pack: ${input.contextPackPath ?? "missing"}`,
        `BA Package: ${input.extra?.baRequirementPackagePath ?? "missing"}`,
      ].join("\n")
    );
  }
}

function generateDiagrams(analysis: RequirementAnalysis): string[] {
  const diagrams: string[] = [];

  // Workflow diagram specific to the requirement type
  diagrams.push(
    "## Workflow Diagram",
    "```mermaid",
    "flowchart TD",
    `  R["${analysis.subject}"] --> A[Analyze Requirement]`,
    "  A --> I[Implement Changes]",
    "  I --> T[Write Tests]",
    "  T --> V[Verify]",
    "  V --> CR[Code Review]",
    "  CR --> D[Done]",
    "```"
  );

  // State diagram relevant to the requirement
  if (analysis.type === "endpoint") {
    diagrams.push(
      "",
      "## State Diagram",
      "```mermaid",
      "stateDiagram-v2",
      "  [*] --> idle",
      "  idle --> processing: request received",
      "  processing --> success: valid input",
      "  processing --> error: invalid input",
      "  success --> [*]",
      "  error --> [*]",
      "```"
    );
  } else if (analysis.type === "validation") {
    diagrams.push(
      "",
      "## State Diagram",
      "```mermaid",
      "stateDiagram-v2",
      "  [*] --> validating",
      "  validating --> accepted: all rules pass",
      "  validating --> rejected: rule violation",
      "  accepted --> [*]",
      "  rejected --> [*]",
      "```"
    );
  } else {
    diagrams.push(
      "",
      "## State Diagram",
      "```mermaid",
      "stateDiagram-v2",
      "  [*] --> pending",
      "  pending --> in_progress: start work",
      "  in_progress --> done: complete",
      "  in_progress --> blocked: issue found",
      "  done --> [*]",
      "  blocked --> [*]",
      "```"
    );
  }

  // Data relationship diagram
  if (analysis.fields.length > 0) {
    const fieldEntities = analysis.fields.slice(0, 4).map((f) => `  CHANGE ||--|| ${f.toUpperCase()} : modifies`).join("\n");
    diagrams.push(
      "",
      "## Data Relationship",
      "```mermaid",
      "erDiagram",
      `  REQUIREMENT ||--|| CHANGE : triggers`,
      fieldEntities,
      "```"
    );
  }

  return diagrams;
}

export class MockSeniorLayerAgent extends BaseAgent {
  public constructor() {
    super("senior_layer");
  }

  public execute(input: AgentInput): AgentRunResult {
    const assessment = getSeniorAssessment(input);

    return completedResult(
      this.name,
      [
        "# Senior Review",
        "",
        renderSeniorValueAssessment(assessment),
      ].join("\n"),
      [
        {
          decision: "Proceed through deterministic workflow gates.",
          rationale: "The structured senior assessment shows acceptable traceability, test readiness, scope risk, and architecture fit.",
          risk: "low",
        },
      ]
    );
  }
}

export class MockTestDesignerAgent extends BaseAgent {
  public constructor() {
    super("test_designer");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");
    const analysis = analyzeRequirement(requirement);
    const testCases = generateTestCases(analysis);
    const commands = Array.isArray(input.extra?.verificationCommands)
      ? input.extra.verificationCommands
      : [];

    return completedResult(
      this.name,
      [
        "# Test Plan",
        "",
        `Requirement: ${requirement}`,
        "",
        `Task Plan: ${input.taskPlanPath ?? "missing"}`,
        "",
        "## Test Cases",
        ...testCases,
        "",
        "## Verification Commands",
        commands.length === 0
          ? "- No commands configured."
          : commands.map((command) => `- ${JSON.stringify(command)}`).join("\n"),
      ].join("\n")
    );
  }
}

function generateTestCases(analysis: RequirementAnalysis): string[] {
  const cases: string[] = [];

  switch (analysis.type) {
    case "endpoint":
      cases.push(
        `### TC-01: ${analysis.endpoints[0] ?? "Endpoint"} returns expected response`,
        `- Send a valid request to ${analysis.endpoints[0] ?? "the endpoint"}.`,
        `- Assert response status is 200.`,
        `- Assert response body contains required fields${analysis.fields.length > 0 ? `: ${analysis.fields.join(", ")}` : ""}.`,
        "",
        `### TC-02: Endpoint returns 404 for missing resource`,
        `- Send a request with an invalid identifier.`,
        "- Assert response status is 404.",
        "- Assert error message is descriptive.",
        "",
        `### TC-03: Endpoint handles invalid input gracefully`,
        "- Send a request with malformed input.",
        "- Assert response status is 400 or 422.",
        "- Assert error response contains validation details."
      );
      break;
    case "validation":
      cases.push(
        "### TC-01: Valid input passes validation",
        "- Send input that satisfies all validation rules.",
        "- Assert the request is accepted.",
        "",
        "### TC-02: Invalid input is rejected with clear error",
        "- Send input that violates each validation rule individually.",
        `- Assert each violation returns a descriptive error message.`,
        "",
        "### TC-03: Boundary values are handled correctly",
        "- Test at exact boundary values (e.g., max file size, enum edges).",
        "- Assert boundary behavior matches specification."
      );
      if (analysis.constraints.length > 0) {
        cases.push(
          "",
          "### TC-04: Constraint-specific tests",
          ...analysis.constraints.slice(0, 3).map((c) => `- Test: ${c}`)
        );
      }
      break;
    case "bug_fix":
      cases.push(
        "### TC-01: Bug reproduction test",
        "- Reproduce the exact scenario described in the requirement.",
        "- Assert the buggy behavior occurs before the fix.",
        "",
        "### TC-02: Fix verification test",
        "- Apply the fix.",
        "- Run the same scenario.",
        "- Assert the expected correct behavior.",
        "",
        "### TC-03: Regression test",
        "- Test related scenarios that should not be affected.",
        "- Assert no unintended side effects."
      );
      break;
    case "error_handling":
      cases.push(
        "### TC-01: Error is caught and returned gracefully",
        "- Trigger the error condition described in the requirement.",
        "- Assert the response is a structured error, not a crash.",
        "",
        "### TC-02: Error response includes required fields",
        "- Assert error response contains status code, message, and correlation ID.",
        "",
        "### TC-03: Retry-after header is present for service errors",
        "- Assert the response includes a Retry-After header when applicable.",
        "",
        "### TC-04: Error is logged with correlation ID",
        "- Assert the error log entry contains the correlation ID from the response."
      );
      break;
    case "test":
      cases.push(
        `### TC-01: Verify test infrastructure`,
        "- Confirm test framework is configured and test files are discoverable.",
        "- Run the test suite to verify it executes without errors.",
        "",
        `### TC-02: Test the specific scenarios from the requirement`,
        `- Requirement: ${analysis.subject}`,
        "- Write one test case per scenario described in the requirement.",
        "- Each test should have a clear name reflecting the scenario.",
        "",
        "### TC-03: Edge cases and error paths",
        "- Test with empty/null inputs.",
        "- Test with boundary values.",
        "- Test with invalid/malformed inputs.",
        "",
        "### TC-04: Test isolation",
        "- Verify tests do not depend on external state.",
        "- Verify tests clean up after themselves."
      );
      break;
    default:
      cases.push(
        "### TC-01: Core functionality works as specified",
        `- Implement and verify the primary behavior: ${analysis.subject}.`,
        "",
        "### TC-02: Edge cases are handled",
        "- Test boundary conditions and unexpected inputs.",
        "",
        "### TC-03: Error scenarios are handled",
        "- Verify graceful handling of failure conditions."
      );
  }

  return cases;
}

export class MockImplementationAgent extends BaseAgent {
  public constructor() {
    super("implementation");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");
    const analysis = analyzeRequirement(requirement);
    const guidance = generateImplementationGuidance(analysis);

    return completedResult(
      this.name,
      [
        "# Implementation Summary",
        "",
        `Requirement: ${requirement}`,
        "",
        `Test Plan: ${input.testPlanPath ?? "missing"}`,
        "",
        "## Implementation Guidance",
        ...guidance,
      ].join("\n")
    );
  }
}

function generateImplementationGuidance(analysis: RequirementAnalysis): string[] {
  const guidance: string[] = [];

  switch (analysis.type) {
    case "endpoint":
      guidance.push(
        `### Target: ${analysis.endpoints.length > 0 ? analysis.endpoints.join(", ") : "New endpoint"}`,
        "",
        "**Files to create or modify:**",
        ...(analysis.files.length > 0 ? analysis.files.map((f) => `- \`${f}\``) : ["- Identify the route handler file from context"]),
        "",
        "**Implementation steps:**",
        `1. Add route handler for ${analysis.endpoints[0] ?? "the endpoint"}.`,
        `2. Define request/response schema${analysis.fields.length > 0 ? ` with fields: ${analysis.fields.join(", ")}` : ""}.`,
        "3. Add database query or service call.",
        "4. Add error handling (404, 400, 500).",
        "5. Register the route in the application."
      );
      break;
    case "validation":
      guidance.push(
        "### Target: Input validation",
        "",
        "**Validation rules to implement:**",
        ...(analysis.constraints.length > 0
          ? analysis.constraints.map((c) => `- ${c}`)
          : ["- Define validation rules from requirement"]),
        "",
        "**Implementation steps:**",
        "1. Add validation function or middleware.",
        "2. Define validation rules with clear error messages.",
        "3. Return 400/422 with structured error response on failure.",
        "4. Pass validated data to the next handler."
      );
      break;
    case "bug_fix":
      guidance.push(
        "### Target: Bug fix",
        "",
        `**Bug description:** ${analysis.raw}`,
        "",
        "**Implementation steps:**",
        "1. Locate the buggy code (search for the pattern described).",
        "2. Understand why the current logic is incorrect.",
        "3. Apply the minimal fix.",
        "4. Add a regression test.",
        "5. Verify the fix and run existing tests."
      );
      break;
    case "error_handling":
      guidance.push(
        "### Target: Error handling",
        "",
        "**Error scenarios to handle:**",
        ...analysis.constraints.map((c) => `- ${c}`),
        "",
        "**Implementation steps:**",
        "1. Wrap the risky operation in try/catch.",
        "2. Create structured error response with status code and message.",
        "3. Add Retry-After header for service unavailability.",
        "4. Log error with correlation ID.",
        "5. Return graceful error response to caller."
      );
      break;
    default:
      guidance.push(
        `### Target: ${analysis.subject}`,
        "",
        "**Implementation steps:**",
        `1. Analyze the requirement: "${analysis.subject}".`,
        `2. Identify affected files${analysis.files.length > 0 ? `: ${analysis.files.join(", ")}` : " from context"}.`,
        "3. Implement the changes.",
        "4. Write tests.",
        "5. Verify the implementation."
      );
  }

  return guidance;
}

export class MockVerificationAgent extends BaseAgent {
  public constructor() {
    super("test_runner_debugger");
  }

  public execute(input: AgentInput): AgentRunResult {
    const results = (input.extra?.verificationResults ?? []) as VerificationResult[];
    const failed = results.filter((result) => !result.passed);
    const findings: AgentFinding[] = failed.map((result) => ({
      severity: "high",
      category: "test",
      description: `Verification failed: ${result.command}`,
      suggestion: result.stderr || "Inspect command output.",
    }));

    return completedResult(
      this.name,
      [
        "# Verification Report",
        "",
        results.length === 0
          ? "No verification commands were run."
          : results.map((result) => {
              const status = result.passed ? "PASS" : "FAIL";
              return `- ${status}: ${result.command} (exit ${result.exitCode}, ${result.durationMs}ms)`;
            }).join("\n"),
      ].join("\n"),
      [],
      findings
    );
  }
}

export class MockCodeReviewerAgent extends BaseAgent {
  public constructor() {
    super("code_reviewer");
  }

  public execute(input: AgentInput): AgentRunResult {
    const requirement = requireText(input, "requirement");
    const analysis = analyzeRequirement(requirement);
    const findings = generateReviewFindings(analysis);

    return completedResult(
      this.name,
      [
        "# Code Review Report",
        "",
        `Requirement: ${requirement}`,
        "",
        "## Findings",
        ...findings,
        "",
        `Verification Report: ${input.verificationReportPath ?? "missing"}`,
      ].join("\n"),
      [],
      [
        {
          severity: "info",
          category: "quality",
          description: `Code review for: ${analysis.subject}`,
        },
      ]
    );
  }
}

function generateReviewFindings(analysis: RequirementAnalysis): string[] {
  const findings: string[] = [];

  switch (analysis.type) {
    case "endpoint":
      findings.push(
        "- **Schema validation:** Ensure request/response schemas are defined and enforced.",
        "- **Error handling:** Verify 404, 400, and 500 responses are implemented.",
        "- **Input sanitization:** Check that path parameters and query strings are validated.",
        "- **Documentation:** Confirm the endpoint is documented in API docs."
      );
      break;
    case "validation":
      findings.push(
        "- **Rule completeness:** Verify all validation rules from the requirement are implemented.",
        "- **Error messages:** Ensure validation error messages are descriptive and actionable.",
        "- **Edge cases:** Check boundary values and empty/null inputs.",
        "- **Performance:** Validation should not block the request pipeline unnecessarily."
      );
      break;
    case "bug_fix":
      findings.push(
        "- **Root cause:** Verify the fix addresses the actual root cause, not just symptoms.",
        "- **Regression test:** Confirm a regression test exists that reproduces the original bug.",
        "- **Side effects:** Check that the fix does not break related functionality.",
        "- **Similar patterns:** Search for the same bug pattern elsewhere in the codebase."
      );
      break;
    case "error_handling":
      findings.push(
        "- **Error types:** Verify specific error types are caught, not generic exceptions.",
        "- **Response format:** Ensure error responses follow the project's error schema.",
        "- **Logging:** Confirm errors are logged with sufficient context (correlation ID, stack trace).",
        "- **Retry logic:** If retry-after is specified, verify the header format is correct."
      );
      break;
    default:
      findings.push(
        `- **Requirement coverage:** Verify the implementation addresses: ${analysis.subject}.`,
        "- **Test coverage:** Confirm test cases cover the main scenarios.",
        "- **Error handling:** Check that failure cases are handled gracefully.",
        "- **Documentation:** Ensure any user-facing changes are documented."
      );
  }

  return findings;
}

export class MockTraceabilityReporterAgent extends BaseAgent {
  public constructor() {
    super("reporter_traceability");
  }

  public execute(input: AgentInput): AgentRunResult {
    return completedResult(
      this.name,
      [
        "# Traceability Report",
        "",
        `Requirement: ${input.requirement ?? "missing"}`,
        "",
        "## Artifact Chain",
        `- Context Pack: ${input.contextPackPath ?? "missing"}`,
        `- Task Plan: ${input.taskPlanPath ?? "missing"}`,
        `- Test Plan: ${input.testPlanPath ?? "missing"}`,
        `- Implementation Summary: ${input.implementationSummaryPath ?? "missing"}`,
        `- Verification Report: ${input.verificationReportPath ?? "missing"}`,
        `- Code Review Report: ${input.codeReviewReportPath ?? "missing"}`,
      ].join("\n")
    );
  }
}

export class MockFinalReporterAgent extends BaseAgent {
  public constructor() {
    super("reporter_traceability");
  }

  public execute(input: AgentInput): AgentRunResult {
    const assessment = getSeniorAssessment(input);

    return completedResult(
      this.name,
      [
        "# Final Report",
        "",
        `Requirement: ${input.requirement ?? "missing"}`,
        "",
        "## Result",
        "The deterministic full workflow completed and produced traceable artifacts.",
        "",
        renderSeniorValueAssessment(assessment),
        "",
        `Traceability Report: ${input.extra?.traceabilityReportPath ?? "missing"}`,
      ].join("\n")
    );
  }
}

export function createDefaultMockAgents(): BaseAgent[] {
  return [
    new MockContextReaderAgent(),
    new MockBAArtifactAgent(),
    new MockVisualModelingAgent(),
    new MockSeniorLayerAgent(),
    new MockPlannerAgent(),
    new MockTestDesignerAgent(),
    new MockImplementationAgent(),
    new MockVerificationAgent(),
    new MockCodeReviewerAgent(),
    new MockTraceabilityReporterAgent(),
    new MockFinalReporterAgent(),
  ];
}

function getSeniorAssessment(input: AgentInput): SeniorValueAssessment {
  if (input.extra?.seniorValueAssessment && typeof input.extra.seniorValueAssessment === "object") {
    return input.extra.seniorValueAssessment as SeniorValueAssessment;
  }

  return buildSeniorValueAssessment(input.requirement ?? "");
}
