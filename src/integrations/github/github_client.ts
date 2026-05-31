import type { GitHubConfig, GitHubIssue, GitHubPR, GitHubRepoInfo } from "./github_types";

export interface GitHubClient {
  testConnection(): Promise<{ ok: boolean; message: string }>;
  getRepoInfo(): Promise<GitHubRepoInfo>;
  listIssues(state?: string): Promise<GitHubIssue[]>;
  getIssue(number: number): Promise<GitHubIssue>;
  createBranch(branchName: string, baseBranch: string): Promise<{ ok: boolean }>;
  commitFiles(branch: string, message: string, files: Array<{ path: string; content: string }>): Promise<{ ok: boolean }>;
  createPullRequest(title: string, body: string, head: string, base: string): Promise<GitHubPR>;
  commentOnIssue(issueNumber: number, body: string): Promise<{ ok: boolean }>;
}

export function loadGitHubConfig(): GitHubConfig {
  return {
    token: process.env.GITHUB_TOKEN || "",
    owner: process.env.GITHUB_OWNER || "",
    repo: process.env.GITHUB_REPO || "",
    defaultBranch: process.env.GITHUB_DEFAULT_BRANCH || "main",
    baseUrl: process.env.GITHUB_BASE_URL || "https://api.github.com",
    prMode: (process.env.GITHUB_PR_MODE as GitHubConfig["prMode"]) || "manual",
  };
}

export function createGitHubClient(config: GitHubConfig): GitHubClient {
  if (!config.token) {
    return new MockGitHubClient();
  }
  return new RealGitHubClient(config);
}

class MockGitHubClient implements GitHubClient {
  public async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock GitHub client (no token configured)" };
  }

  public async getRepoInfo(): Promise<GitHubRepoInfo> {
    return { owner: "mock-owner", repo: "mock-repo", defaultBranch: "main", private: false };
  }

  public async listIssues(): Promise<GitHubIssue[]> {
    return [
      { number: 1, title: "Sample issue", body: "Add GET /health/details endpoint", state: "open", labels: ["enhancement"], url: "https://github.com/mock/mock/issues/1" },
    ];
  }

  public async getIssue(number: number): Promise<GitHubIssue> {
    return { number, title: "Sample issue", body: "Add GET /health/details endpoint", state: "open", labels: ["enhancement"], url: `https://github.com/mock/mock/issues/${number}` };
  }

  public async createBranch(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  public async commitFiles(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  public async createPullRequest(title: string): Promise<GitHubPR> {
    return { number: 1, url: "https://github.com/mock/mock/pull/1", title, state: "open", branch: "mock-branch" };
  }

  public async commentOnIssue(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

class RealGitHubClient implements GitHubClient {
  private readonly config: GitHubConfig;

  public constructor(config: GitHubConfig) {
    this.config = config;
  }

  private async request(path: string, options: { method?: string; body?: unknown } = {}): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DevMIRA-Workflow",
    };

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  public async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.request(`/repos/${this.config.owner}/${this.config.repo}`);
      return { ok: true, message: "Connected to GitHub" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
    }
  }

  public async getRepoInfo(): Promise<GitHubRepoInfo> {
    const data = (await this.request(`/repos/${this.config.owner}/${this.config.repo}`)) as Record<string, unknown>;
    return {
      owner: this.config.owner,
      repo: this.config.repo,
      defaultBranch: (data.default_branch as string) || this.config.defaultBranch,
      private: data.private as boolean,
    };
  }

  public async listIssues(state: string = "open"): Promise<GitHubIssue[]> {
    const data = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/issues?state=${state}`)) as Array<Record<string, unknown>>;
    return data.map((issue) => ({
      number: issue.number as number,
      title: issue.title as string,
      body: (issue.body as string) || "",
      state: issue.state as string,
      labels: ((issue.labels as Array<Record<string, unknown>>) || []).map((l) => l.name as string),
      url: issue.html_url as string,
    }));
  }

  public async getIssue(number: number): Promise<GitHubIssue> {
    const data = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/issues/${number}`)) as Record<string, unknown>;
    return {
      number: data.number as number,
      title: data.title as string,
      body: (data.body as string) || "",
      state: data.state as string,
      labels: ((data.labels as Array<Record<string, unknown>>) || []).map((l) => l.name as string),
      url: data.html_url as string,
    };
  }

  public async createBranch(branchName: string, baseBranch: string): Promise<{ ok: boolean }> {
    const baseRef = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${baseBranch}`)) as Record<string, unknown>;
    const sha = ((baseRef.object as Record<string, unknown>).sha as string);
    await this.request(`/repos/${this.config.owner}/${this.config.repo}/git/refs`, {
      method: "POST",
      body: { ref: `refs/heads/${branchName}`, sha },
    });
    return { ok: true };
  }

  public async commitFiles(branch: string, message: string, files: Array<{ path: string; content: string }>): Promise<{ ok: boolean }> {
    // Get the current commit SHA on the branch
    const ref = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${branch}`)) as Record<string, unknown>;
    const commitSha = ((ref.object as Record<string, unknown>).sha as string);

    // Get the tree SHA
    const commit = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/git/commits/${commitSha}`)) as Record<string, unknown>;
    const treeSha = (commit.tree as Record<string, unknown>).sha as string;

    // Create blobs for each file
    const treeItems = [];
    for (const file of files) {
      const blob = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/git/blobs`, {
        method: "POST",
        body: { content: file.content, encoding: "utf-8" },
      })) as Record<string, unknown>;
      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha as string });
    }

    // Create new tree
    const newTree = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/git/trees`, {
      method: "POST",
      body: { base_tree: treeSha, tree: treeItems },
    })) as Record<string, unknown>;

    // Create new commit
    const newCommit = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/git/commits`, {
      method: "POST",
      body: { message, tree: newTree.sha, parents: [commitSha] },
    })) as Record<string, unknown>;

    // Update branch reference
    await this.request(`/repos/${this.config.owner}/${this.config.repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: { sha: newCommit.sha },
    });

    return { ok: true };
  }

  public async createPullRequest(title: string, body: string, head: string, base: string): Promise<GitHubPR> {
    const data = (await this.request(`/repos/${this.config.owner}/${this.config.repo}/pulls`, {
      method: "POST",
      body: { title, body, head, base },
    })) as Record<string, unknown>;
    return {
      number: data.number as number,
      url: data.html_url as string,
      title: data.title as string,
      state: data.state as string,
      branch: head,
    };
  }

  public async commentOnIssue(issueNumber: number, body: string): Promise<{ ok: boolean }> {
    await this.request(`/repos/${this.config.owner}/${this.config.repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      body: { body },
    });
    return { ok: true };
  }
}
