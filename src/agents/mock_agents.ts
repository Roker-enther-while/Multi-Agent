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
  // Check docs first since it may contain "endpoint" or "api" references
  if (/update.*doc|documentation|readme|api\.md|curl example/i.test(requirement)) type = "docs";
  else if (/(?:GET|POST|PUT|DELETE|PATCH)\s+\/\S+/.test(requirement) || /add (?:a |the )?(?:new )?(?:endpoint|route)/i.test(requirement)) type = "endpoint";
  else if (/add.*valid/i.test(requirement)) type = "validation";
  else if (/change|rename|update.*response|field/i.test(requirement)) type = "response_change";
  else if (/error|exception|catch|retry|graceful/i.test(requirement)) type = "error_handling";
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
    const analysis = analyzeRequirement(requirement);
    const codeSummary = input.extra?.codeSummary as Record<string, unknown> | undefined;
    const allFiles: string[] = codeSummary && typeof codeSummary === "object" && Array.isArray(codeSummary.files)
      ? (codeSummary.files as string[])
      : [];
    const relevantFiles = findRelevantFiles(analysis, allFiles);
    const filesJson = codeSummary && typeof codeSummary === "object"
      ? JSON.stringify(codeSummary, null, 2)
      : "No code summary provided.";

    return completedResult(
      this.name,
      [
        "# Context Pack",
        "",
        "## Requirement",
        requirement,
        "",
        "## Requirement Analysis",
        `- Type: ${analysis.type}`,
        `- Subject: ${analysis.subject}`,
        analysis.endpoints.length > 0 ? `- Endpoints: ${analysis.endpoints.join(", ")}` : "",
        analysis.fields.length > 0 ? `- Fields: ${analysis.fields.join(", ")}` : "",
        analysis.files.length > 0 ? `- Referenced files: ${analysis.files.join(", ")}` : "",
        analysis.constraints.length > 0 ? `- Constraints: ${analysis.constraints.slice(0, 5).join("; ")}` : "",
        "",
        "## Likely Relevant Files",
        relevantFiles.length > 0
          ? relevantFiles.map((f) => `- \`${f}\``).join("\n")
          : "- No specific files identified; inspect the full repository context below.",
        "",
        "## Repository Context",
        "```json",
        filesJson,
        "```",
      ].filter((line) => line !== "").join("\n")
    );
  }
}

function findRelevantFiles(analysis: RequirementAnalysis, allFiles: string[]): string[] {
  const relevant: string[] = [];
  const lower = (s: string) => s.toLowerCase();

  // If the requirement explicitly mentions files, include them
  for (const file of analysis.files) {
    const match = allFiles.find((f) => f.includes(file));
    if (match && !relevant.includes(match)) relevant.push(match);
  }

  // Type-based file matching
  switch (analysis.type) {
    case "endpoint":
      allFiles.filter((f) => /routes?|api|endpoint|handler/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      allFiles.filter((f) => /schema|model|types/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "validation":
      allFiles.filter((f) => /routes?|api|schema|valid/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "response_change":
      allFiles.filter((f) => /schema|types?|api|routes?|search/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "error_handling":
      allFiles.filter((f) => /ingestion|error|handler|middleware/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "docs":
      allFiles.filter((f) => /\.md$|docs?\//i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "cli_option":
      allFiles.filter((f) => /cli|command|arg|option/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "config":
      allFiles.filter((f) => /\.ya?ml$|config/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "test":
      allFiles.filter((f) => /test|spec|__test__/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      allFiles.filter((f) => /planner/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "report":
      allFiles.filter((f) => /report|eval|metric|script/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
    case "bug_fix":
      allFiles.filter((f) => /temporal|retriev/i.test(f)).forEach((f) => { if (!relevant.includes(f)) relevant.push(f); });
      break;
  }

  // Also match based on keywords in the requirement
  const keywords = analysis.subject.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  for (const keyword of keywords) {
    for (const file of allFiles) {
      if (file.toLowerCase().includes(keyword) && !relevant.includes(file)) {
        relevant.push(file);
      }
    }
  }

  return relevant.slice(0, 15);
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
  const scenarios = extractTestScenarios(analysis);

  // Always start with Positive Tests
  cases.push("## Positive Tests");
  switch (analysis.type) {
    case "endpoint":
      cases.push(
        `### TC-P01: ${analysis.endpoints[0] ?? "Endpoint"} returns expected response`,
        `- Send a valid request to ${analysis.endpoints[0] ?? "the endpoint"}.`,
        `- Assert response status is 200.`,
        `- Assert response body contains required fields${analysis.fields.length > 0 ? `: ${analysis.fields.join(", ")}` : ""}.`,
        "",
        `### TC-P02: Endpoint returns correct data format`,
        "- Assert response Content-Type is application/json.",
        "- Assert all expected fields are present and non-null.",
        "- Assert field types match the schema (string, number, array, object)."
      );
      break;
    case "validation":
      cases.push(
        "### TC-P01: Valid input passes all validation rules",
        "- Send input that satisfies every validation rule.",
        "- Assert the request is accepted (200 or 201).",
        "",
        "### TC-P02: Each valid enum value is accepted",
        ...analysis.constraints.filter((c) => /one of|enum|must be/i.test(c)).map((c) => `- Test each valid value: ${c}`),
      );
      break;
    case "docs":
      cases.push(
        "### TC-P01: Documentation file exists and is readable",
        `- Verify the target documentation file exists.`,
        "- Assert the file is valid markdown.",
        "",
        "### TC-P02: Required sections are present",
        "- Assert all required headings and sections exist.",
        "- Assert code examples are syntactically valid."
      );
      break;
    case "config":
      cases.push(
        "### TC-P01: Configuration file is valid YAML",
        "- Parse the configuration file without errors.",
        "- Assert all required keys are present.",
        "",
        "### TC-P02: Default values work correctly",
        "- Load configuration with defaults.",
        "- Assert the system starts and operates with default settings."
      );
      break;
    case "bug_fix":
      cases.push(
        "### TC-P01: Bug fix verification",
        "- Run the exact scenario described in the requirement.",
        "- Assert the expected correct behavior occurs.",
        "",
        "### TC-P02: Fix works for similar inputs",
        "- Test with variations of the bug-triggering input.",
        "- Assert all variations produce correct results."
      );
      break;
    default:
      cases.push(
        `### TC-P01: Primary behavior works as specified`,
        `- Verify the core functionality: ${analysis.subject}.`,
        "- Assert the expected outcome is produced.",
        "",
        "### TC-P02: Happy path with typical inputs",
        "- Test with normal, expected inputs.",
        "- Assert correct output for each."
      );
  }

  // Negative Tests
  cases.push("", "## Negative Tests");
  switch (analysis.type) {
    case "endpoint":
      cases.push(
        "### TC-N01: Invalid resource returns 404",
        "- Request a non-existent resource identifier.",
        "- Assert 404 with descriptive error message.",
        "",
        "### TC-N02: Malformed request returns 400",
        "- Send request with invalid body or parameters.",
        "- Assert 400 with validation error details.",
        "",
        "### TC-N03: Missing required fields returns 422",
        "- Send request omitting required fields one at a time.",
        "- Assert 422 with field-specific error messages."
      );
      break;
    case "validation":
      cases.push(
        "### TC-N01: Each validation rule rejects invalid input",
        ...analysis.constraints.slice(0, 4).map((c, i) => `- TC-N01-${i + 1}: Test violation of: ${c}`),
        "",
        "### TC-N02: Empty/null input is rejected",
        "- Send empty body, null fields, or missing required fields.",
        "- Assert appropriate error status and message.",
        "",
        "### TC-N03: Oversized input is rejected",
        "- Send input exceeding size limits.",
        "- Assert 413 or 400 with clear error."
      );
      break;
    case "bug_fix":
      cases.push(
        "### TC-N01: Bug scenario no longer occurs",
        "- Reproduce the exact bug-triggering conditions.",
        "- Assert the buggy behavior no longer happens.",
        "",
        "### TC-N02: Related error paths still work",
        "- Test error conditions adjacent to the bug.",
        "- Assert they still produce correct error responses."
      );
      break;
    default:
      cases.push(
        "### TC-N01: Invalid inputs are rejected",
        "- Send malformed, empty, or out-of-range inputs.",
        "- Assert appropriate error responses.",
        "",
        "### TC-N02: Missing required data is handled",
        "- Omit required fields or parameters.",
        "- Assert clear error messages."
      );
  }

  // Edge Cases
  cases.push("", "## Edge Cases");
  cases.push(
    "### TC-E01: Boundary values",
    "- Test at minimum and maximum allowed values.",
    "- Assert behavior matches specification at boundaries.",
    "",
    "### TC-E02: Empty and null inputs",
    "- Test with empty strings, null values, and missing fields.",
    "- Assert graceful handling without crashes."
  );
  if (analysis.type === "endpoint") {
    cases.push(
      "",
      "### TC-E03: Special characters in parameters",
      "- Test with Unicode, SQL injection patterns, and XSS payloads.",
      "- Assert input is sanitized or rejected."
    );
  }

  // Regression Tests
  cases.push("", "## Regression Tests");
  cases.push(
    "### TC-R01: Existing functionality is not broken",
    "- Run existing test suite to verify no regressions.",
    "- Assert all previously passing tests still pass.",
    "",
    "### TC-R02: Related features still work",
    "- Test features that interact with the changed code.",
    "- Assert no unintended side effects."
  );
  if (analysis.type === "bug_fix") {
    cases.push(
      "",
      "### TC-R03: Bug-specific regression",
      "- Add a test that specifically reproduces the original bug.",
      "- Assert this test passes after the fix.",
      "- This test should fail if the bug is reintroduced."
    );
  }

  // Requirement-specific scenarios
  if (scenarios.length > 0) {
    cases.push("", "## Requirement-Specific Scenarios");
    for (let i = 0; i < scenarios.length; i++) {
      cases.push(
        `### TC-S${String(i + 1).padStart(2, "0")}: ${scenarios[i]}`,
        `- Verify: ${scenarios[i]}`,
        "- Assert expected behavior."
      );
    }
  }

  return cases;
}

function extractTestScenarios(analysis: RequirementAnalysis): string[] {
  const scenarios: string[] = [];

  // Extract specific scenarios from constraints
  for (const constraint of analysis.constraints.slice(0, 5)) {
    scenarios.push(constraint);
  }

  // Extract scenarios from fields
  if (analysis.fields.length > 0) {
    scenarios.push(`Verify fields present: ${analysis.fields.join(", ")}`);
  }

  // Extract scenarios from endpoints
  if (analysis.endpoints.length > 0) {
    scenarios.push(`Verify endpoint ${analysis.endpoints[0]} is accessible and returns correct response`);
  }

  // Type-specific scenarios
  switch (analysis.type) {
    case "validation":
      scenarios.push("Verify all validation rules are enforced individually");
      scenarios.push("Verify validation error messages are descriptive");
      break;
    case "error_handling":
      scenarios.push("Verify error is caught and returned gracefully");
      scenarios.push("Verify error logging includes correlation ID");
      break;
    case "docs":
      scenarios.push("Verify all endpoints are documented with curl examples");
      scenarios.push("Verify request/response schemas are complete");
      break;
    case "config":
      scenarios.push("Verify configuration loads without errors");
      scenarios.push("Verify all config keys have sensible defaults");
      break;
    case "report":
      scenarios.push("Verify all required metrics are included in output");
      scenarios.push("Verify export formats are valid and complete");
      break;
  }

  return scenarios;
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

  // Common header with requirement-specific target
  guidance.push(
    `### Target: ${analysis.subject}`,
    ""
  );

  // Files to modify (from requirement analysis)
  if (analysis.files.length > 0) {
    guidance.push("**Files explicitly referenced in requirement:**");
    for (const file of analysis.files) {
      guidance.push(`- \`${file}\``);
    }
    guidance.push("");
  }

  // Type-specific implementation guidance
  switch (analysis.type) {
    case "endpoint":
      guidance.push(
        "**Files to create or modify:**",
        "- Route handler file (e.g., `backend/app/api/routes_*.ts` or `backend/app/api/*.py`)",
        "- Schema file (e.g., `backend/app/schemas/*.py`)",
        "- Router registration file (e.g., `backend/app/main.py`)",
        "",
        "**Implementation steps:**",
        `1. Create or modify route handler for ${analysis.endpoints[0] ?? "the endpoint"}.`,
        `2. Define Pydantic/TypeScript request/response schema${analysis.fields.length > 0 ? ` with fields: ${analysis.fields.join(", ")}` : ""}.`,
        "3. Implement business logic (database query, service call, data transformation).",
        "4. Add error handling: 404 for not found, 400 for bad request, 500 for server errors.",
        "5. Register the route in the application router.",
        "6. Add docstring/JSDoc with endpoint description and parameter docs."
      );
      break;
    case "validation":
      guidance.push(
        "**Files to create or modify:**",
        "- Route handler or middleware file",
        "- Validation schema or rules file",
        "- Error response schema",
        "",
        "**Validation rules to implement:**",
        ...(analysis.constraints.length > 0
          ? analysis.constraints.map((c) => `- ${c}`)
          : ["- Define validation rules from requirement"]),
        "",
        "**Implementation steps:**",
        "1. Add validation function or middleware at the API boundary.",
        "2. Define each validation rule with a clear, descriptive error message.",
        "3. Return 400/422 with structured error response on validation failure.",
        "4. Include the field name and violated rule in the error response.",
        "5. Pass validated (and possibly transformed) data to the next handler."
      );
      break;
    case "bug_fix":
      guidance.push(
        `**Bug description:** ${analysis.raw}`,
        "",
        "**Implementation steps:**",
        "1. Locate the buggy code (search for the pattern described in the requirement).",
        "2. Understand why the current logic is incorrect (e.g., falsy check vs. explicit undefined check).",
        "3. Apply the minimal fix that addresses the root cause.",
        "4. Add a regression test that reproduces the bug and verifies the fix.",
        "5. Run the full test suite to verify no regressions.",
        "6. Search for similar patterns elsewhere in the codebase."
      );
      break;
    case "error_handling":
      guidance.push(
        "**Error scenarios to handle:**",
        ...analysis.constraints.map((c) => `- ${c}`),
        "",
        "**Implementation steps:**",
        "1. Wrap the risky operation in try/catch with specific exception types.",
        "2. Create structured error response with HTTP status code and descriptive message.",
        "3. Add Retry-After header for service unavailability (503) responses.",
        "4. Log the error with correlation ID, timestamp, and stack trace.",
        "5. Return graceful error response to the caller (never expose internal details)."
      );
      break;
    case "docs":
      guidance.push(
        "**Files to modify:**",
        "- Target documentation file (e.g., `docs/api.md`)",
        "",
        "**Content to add:**",
        "- Endpoint documentation with HTTP method and path",
        "- Request schema with field descriptions and types",
        "- Response schema with field descriptions and types",
        "- Error response documentation",
        "- curl examples for each endpoint",
        "",
        "**Implementation steps:**",
        "1. Read the existing documentation to understand the format and style.",
        "2. Add new endpoint documentation following the existing pattern.",
        "3. Include request/response JSON examples.",
        "4. Add curl command examples with realistic sample data.",
        "5. Update the table of contents or index if present.",
        "6. Verify all code examples are syntactically correct."
      );
      break;
    case "cli_option":
      guidance.push(
        "**Files to modify:**",
        "- CLI entry point (e.g., `src/cli.ts` or `cli.py`)",
        "- Help text / usage documentation",
        "",
        "**Implementation steps:**",
        "1. Add the new option to the argument parser.",
        "2. Define allowed values and default value.",
        "3. Add validation for invalid option values.",
        "4. Implement the option-specific behavior.",
        "5. Update help text to document the new option.",
        "6. Add tests for each valid value and invalid value."
      );
      break;
    case "config":
      guidance.push(
        "**Files to create or modify:**",
        "- Configuration file (e.g., `configs/*.yaml` or `config.json`)",
        "- Configuration loader/parser",
        "- Default values definition",
        "",
        "**Implementation steps:**",
        "1. Define the configuration schema with all required keys.",
        "2. Set sensible default values for optional keys.",
        "3. Add validation for configuration values (types, ranges, required fields).",
        "4. Update the configuration loader to parse the new section.",
        "5. Add documentation for each configuration key.",
        "6. Add tests for valid config, missing keys, and invalid values."
      );
      break;
    case "test":
      guidance.push(
        "**Files to create or modify:**",
        "- Test file (e.g., `backend/tests/test_*.py` or `src/**/*.test.ts`)",
        "- Test fixtures/conftest if needed",
        "",
        "**Implementation steps:**",
        "1. Identify the class/module under test from the requirement.",
        "2. Set up test fixtures and mock dependencies.",
        "3. Write one test per scenario described in the requirement.",
        "4. Add edge case tests (empty input, boundary values, special characters).",
        "5. Ensure tests are isolated and do not depend on external state.",
        "6. Run the test suite and verify all tests pass."
      );
      break;
    case "report":
      guidance.push(
        "**Files to modify:**",
        "- Report generation script/module",
        "- Output format templates",
        "",
        "**Implementation steps:**",
        "1. Identify the report generation entry point.",
        "2. Add new metrics or fields to the report output.",
        "3. Implement the new export format (JSON, CSV, etc.).",
        "4. Add histogram or visualization data generation.",
        "5. Update report templates to include new sections.",
        "6. Add tests for each new metric and export format."
      );
      break;
    case "response_change":
      guidance.push(
        "**Files to modify:**",
        "- Response schema definition",
        "- Route handler that builds the response",
        "- Client-side type definitions (if applicable)",
        "",
        "**Implementation steps:**",
        "1. Update the response schema to include the new field(s).",
        "2. Update the route handler to populate the new field(s).",
        "3. Handle backward compatibility if needed (optional fields, versioning).",
        "4. Update API documentation.",
        "5. Add tests for the new field(s) and renamed field(s).",
        "6. Update client-side type definitions."
      );
      break;
    default:
      guidance.push(
        "**Implementation steps:**",
        `1. Analyze the requirement: "${analysis.subject}".`,
        `2. Identify affected files${analysis.files.length > 0 ? `: ${analysis.files.join(", ")}` : " from context"}.`,
        "3. Implement the changes with clear, readable code.",
        "4. Write tests covering positive, negative, and edge cases.",
        "5. Verify the implementation against the requirement."
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

  // Always include requirement coverage and risk assessment
  findings.push(
    "## Requirement Coverage",
    `- **Requirement:** ${analysis.subject}`,
    `- **Type:** ${analysis.type}`,
    analysis.fields.length > 0 ? `- **Fields involved:** ${analysis.fields.join(", ")}` : "",
    analysis.constraints.length > 0 ? `- **Constraints:** ${analysis.constraints.slice(0, 3).join("; ")}` : "",
    ""
  );

  // Type-specific findings
  findings.push("## Type-Specific Findings");
  switch (analysis.type) {
    case "endpoint":
      findings.push(
        "- **Schema validation:** Ensure request/response schemas are defined and enforced.",
        "- **Error handling:** Verify 404, 400, and 500 responses are implemented.",
        "- **Input sanitization:** Check that path parameters and query strings are validated.",
        "- **Documentation:** Confirm the endpoint is documented in API docs.",
        "- **Risk:** New endpoints may expose sensitive data; verify authentication/authorization."
      );
      break;
    case "validation":
      findings.push(
        "- **Rule completeness:** Verify all validation rules from the requirement are implemented.",
        "- **Error messages:** Ensure validation error messages are descriptive and actionable.",
        "- **Edge cases:** Check boundary values and empty/null inputs.",
        "- **Performance:** Validation should not block the request pipeline unnecessarily.",
        "- **Risk:** Incomplete validation may allow invalid data into the system."
      );
      break;
    case "bug_fix":
      findings.push(
        "- **Root cause:** Verify the fix addresses the actual root cause, not just symptoms.",
        "- **Regression test:** Confirm a regression test exists that reproduces the original bug.",
        "- **Side effects:** Check that the fix does not break related functionality.",
        "- **Similar patterns:** Search for the same bug pattern elsewhere in the codebase.",
        `- **Risk:** ${analysis.raw}`
      );
      break;
    case "error_handling":
      findings.push(
        "- **Error types:** Verify specific error types are caught, not generic exceptions.",
        "- **Response format:** Ensure error responses follow the project's error schema.",
        "- **Logging:** Confirm errors are logged with sufficient context (correlation ID, stack trace).",
        "- **Retry logic:** If retry-after is specified, verify the header format is correct.",
        "- **Risk:** Unhandled exceptions may crash the service or leak internal details."
      );
      break;
    case "docs":
      findings.push(
        "- **Completeness:** Verify all endpoints/methods are documented.",
        "- **Accuracy:** Verify request/response schemas match the actual implementation.",
        "- **Examples:** Verify curl examples are syntactically correct and runnable.",
        "- **Style:** Verify documentation follows the project's existing style.",
        "- **Risk:** Incorrect documentation may误导 API consumers."
      );
      break;
    case "cli_option":
      findings.push(
        "- **Option parsing:** Verify the option is correctly parsed by the argument parser.",
        "- **Default value:** Verify the default value is backward-compatible.",
        "- **Invalid values:** Verify invalid values produce clear error messages.",
        "- **Help text:** Verify the option appears in --help output.",
        "- **Risk:** Breaking CLI interface may affect automation scripts."
      );
      break;
    case "config":
      findings.push(
        "- **Schema:** Verify configuration schema is well-defined with types and defaults.",
        "- **Validation:** Verify invalid configuration values are caught at startup.",
        "- **Documentation:** Verify each configuration key is documented.",
        "- **Backward compatibility:** Verify existing configurations still work.",
        "- **Risk:** Invalid configuration may cause silent failures or incorrect behavior."
      );
      break;
    case "test":
      findings.push(
        "- **Coverage:** Verify all scenarios from the requirement are covered by tests.",
        "- **Isolation:** Verify tests do not depend on external state or other tests.",
        "- **Assertions:** Verify each test has meaningful assertions (not just no-crash).",
        "- **Naming:** Verify test names clearly describe what they test.",
        "- **Risk:** Weak tests may give false confidence in code correctness."
      );
      break;
    case "report":
      findings.push(
        "- **Accuracy:** Verify reported metrics match actual data.",
        "- **Completeness:** Verify all required metrics/fields are included.",
        "- **Format:** Verify export formats (JSON, CSV) are valid and parseable.",
        "- **Performance:** Verify report generation does not block other operations.",
        "- **Risk:** Incorrect metrics may lead to wrong decisions."
      );
      break;
    case "response_change":
      findings.push(
        "- **Backward compatibility:** Verify existing clients are not broken by the change.",
        "- **Schema:** Verify the new field is correctly typed and documented.",
        "- **Migration:** Verify any data migration needed for the rename.",
        "- **Tests:** Verify tests cover both old and new field names if applicable.",
        "- **Risk:** Breaking API changes may affect downstream consumers."
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

  return findings.filter((line) => line !== "");
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
