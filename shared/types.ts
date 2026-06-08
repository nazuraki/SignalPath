export type Stage =
  | 'backlog'
  | 'progress'
  | 'review'
  | 'pending'
  | 'releasing'
  | 'released'
  | 'done';

export interface Issue {
  key: string;
  summary: string;
  status: string;
  points: number | null;
  resolutiondate: string | null;
  labels: string[];
  components: string[];
}

export interface Workstream {
  key: string;
  summary: string;
  status: string;
  created: string;
  duedate: string | null;
  issues: Issue[];
  /** Set client-side from a forward projection of remaining work. */
  projectedEnd?: string;
}

export interface ParityConfig {
  epic: string | null;
  svcMap: Record<string, string>;
  svcLabelMap: Record<string, string>;
  modMap: Record<string, string>;
  na: Record<string, string[]>;
}

export interface UIConfig {
  title: string;
  subtitle: string;
}

export interface JiraTicketConfig {
  base: string;
  email: string;
  apiToken: string;
  spField: string;
  /** Secondary field tried when spField is absent/non-numeric. Used raw (no ÷3600). */
  spFieldFallback?: string;
  epics: string[];
}

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  milestones?: number[];
}

export interface GitHubTicketConfig {
  token: string;
  repos: GitHubRepoConfig[];
  /** Label name (case-insensitive) → points. First matching label on an issue wins. */
  pointsLabels: Record<string, number>;
}

export interface TicketsConfig {
  provider: 'jira' | 'github' | 'none';
  jira?: JiraTicketConfig;
  github?: GitHubTicketConfig;
  /** Maps a provider status string (case-insensitive) to a SignalPath stage. */
  stageMap: Record<string, Stage>;
}

export interface DeploysConfig {
  provider: 'none';
}

export interface MetricsConfig {
  provider: 'none';
}

/** Server-side, full config. */
export interface ServerConfig {
  ui: UIConfig;
  server: {
    port: number;
  };
  tickets: TicketsConfig;
  deploys: DeploysConfig;
  metrics: MetricsConfig;
  parity: ParityConfig;
}

/** Shape returned by GET /api/config. */
export interface ClientConfig {
  ui: UIConfig;
  ticketProvider: 'jira' | 'github' | 'none';
  /** Base URL for linking out to tickets. Jira base for jira, "https://github.com" for github, empty otherwise. */
  ticketBase: string;
  /** Provider status string (case-insensitive) → SignalPath stage. */
  stageMap: Record<string, Stage>;
  parity: ParityConfig;
}

export interface BurndownPoint {
  date: string;
  label: string;
  actual: number | null;
  ideal: number;
}

export interface BurndownResult {
  series: BurndownPoint[];
  totalPoints: number;
  remaining: number;
  completedPoints: number;
  pctComplete: number;
  issueCount: number;
  doneCount: number;
}

export interface WorkstreamPair {
  workstream: Workstream;
  bd: BurndownResult;
}

export interface TicketState {
  pr?: string;
  deployAppId?: string;
  metricsUrl?: string;
  /** ISO 8601 datetime string, e.g. "2024-01-15T10:30:00.000Z" */
  deployedAt?: string;
  notes?: string;
}

export type StateMap = Record<string, TicketState>;
