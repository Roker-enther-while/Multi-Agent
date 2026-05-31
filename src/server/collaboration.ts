export type UserRole = "ba" | "developer" | "reviewer" | "tester" | "tech_lead" | "admin";
export type ApprovalState = "draft" | "ready_for_review" | "changes_requested" | "approved" | "completed";

export interface Comment {
  id: string;
  author: string;
  role: UserRole;
  content: string;
  targetType: "run" | "artifact" | "diff" | "finding";
  targetId?: string;
  createdAt: string;
}

export interface Approval {
  state: ApprovalState;
  approvedBy?: string;
  approvedAt?: string;
  comments?: string;
}

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  decision: string;
  rationale: string;
  relatedArtifact?: string;
}

export interface CollaborationData {
  owner: string;
  reviewers: string[];
  approval: Approval;
  comments: Comment[];
  decisionLog: DecisionLogEntry[];
}

export function createDefaultCollaboration(owner: string = "user"): CollaborationData {
  return {
    owner,
    reviewers: [],
    approval: { state: "draft" },
    comments: [],
    decisionLog: [],
  };
}

export function addComment(
  collab: CollaborationData,
  author: string,
  role: UserRole,
  content: string,
  targetType: Comment["targetType"],
  targetId?: string
): Comment {
  const comment: Comment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author,
    role,
    content,
    targetType,
    targetId,
    createdAt: new Date().toISOString(),
  };
  collab.comments.push(comment);
  return comment;
}

export function setApprovalState(
  collab: CollaborationData,
  state: ApprovalState,
  actor: string,
  comments?: string
): void {
  collab.approval.state = state;
  if (state === "approved") {
    collab.approval.approvedBy = actor;
    collab.approval.approvedAt = new Date().toISOString();
  }
  if (comments) {
    collab.approval.comments = comments;
  }
}

export function addDecisionLogEntry(
  collab: CollaborationData,
  actor: string,
  role: UserRole,
  decision: string,
  rationale: string,
  relatedArtifact?: string
): DecisionLogEntry {
  const entry: DecisionLogEntry = {
    id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor,
    role,
    decision,
    rationale,
    relatedArtifact,
  };
  collab.decisionLog.push(entry);
  return entry;
}

export function generateDecisionLogMarkdown(collab: CollaborationData): string {
  const lines: string[] = [
    "# Decision Log",
    "",
    `**Owner:** ${collab.owner}`,
    `**Approval State:** ${collab.approval.state}`,
    "",
    "## Decisions",
    "",
  ];

  if (collab.decisionLog.length === 0) {
    lines.push("No decisions recorded.");
  } else {
    for (const entry of collab.decisionLog) {
      lines.push(`### ${entry.id}`);
      lines.push(`- **Time:** ${entry.timestamp}`);
      lines.push(`- **Actor:** ${entry.actor} (${entry.role})`);
      lines.push(`- **Decision:** ${entry.decision}`);
      lines.push(`- **Rationale:** ${entry.rationale}`);
      if (entry.relatedArtifact) lines.push(`- **Related:** ${entry.relatedArtifact}`);
      lines.push("");
    }
  }

  if (collab.comments.length > 0) {
    lines.push("## Comments", "");
    for (const comment of collab.comments) {
      lines.push(`- **${comment.author}** (${comment.role}) at ${comment.createdAt}: ${comment.content}`);
    }
  }

  return lines.join("\n");
}
