export interface Issue {
  key: string;
  summary: string;
  status: string;
  points: number | null;
  resolutiondate: string | null;
  labels: string[];
  components: string[];
}

export interface Epic {
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

/** Server-side, full config. */
export interface ServerConfig {
  ui: UIConfig;
  server: {
    port: number;
  };
  jira: {
    base: string;
    email: string;
    apiToken: string;
    spField: string;
    epics: string[];
  };
  parity: ParityConfig;
}

/** Shape returned by GET /api/config. */
export interface ClientConfig {
  ui: UIConfig;
  jiraBase: string;
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

export interface EpicPair {
  epic: Epic;
  bd: BurndownResult;
}
