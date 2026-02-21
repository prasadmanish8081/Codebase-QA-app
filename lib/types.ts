export type RepoSourceType = "github" | "zip";

export type RepoGitMeta = {
  owner: string;
  repo: string;
  branch: string;
  url: string;
};

export type StoredSnippet = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  code: string;
  score: number;
  sourceUrl?: string;
};

export type QARecord = {
  id: string;
  createdAt: string;
  question: string;
  answer: string;
  repoLabel: string;
  snippets: StoredSnippet[];
};

export type RepoFile = {
  path: string;
  content: string;
};

export type RepoState = {
  sourceType: RepoSourceType;
  sourceLabel: string;
  files: RepoFile[];
  ingestedAt: string;
  github?: RepoGitMeta;
};

export type AppState = {
  repo: RepoState | null;
  qas: QARecord[];
};
