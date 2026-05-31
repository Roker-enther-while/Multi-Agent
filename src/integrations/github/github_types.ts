export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  baseUrl: string;
  prMode: "disabled" | "manual" | "auto";
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  url: string;
}

export interface GitHubPR {
  number: number;
  url: string;
  title: string;
  state: string;
  branch: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  private: boolean;
}
