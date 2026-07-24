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

export type ReleasePhase =
  | 'idle' // no recent run found
  | 'running' // CI job in flight (or CI done, kubectl rollout in progress for trigger mode)
  | 'complete' // released successfully
  | 'failed' // CI or rollout failed
  | 'unreachable'; // kubectl cluster not reachable (VPN down, etc.)

export interface ReleaseStatus {
  svcKey: string;
  phase: ReleasePhase;
  /** URL to the GHA run or Argo app */
  runUrl?: string;
  startedAt?: string;
  completedAt?: string;
  /** Human-readable detail, e.g. kubectl error message */
  detail?: string;
}

export interface DeployServiceConfig {
  owner: string;
  repo: string;
  /** GitHub Actions workflow filename, e.g. "release.yml" */
  workflow: string;
  /**
   * "complete" — the CI job finishing means the release is done.
   * "trigger"  — the CI job only starts the deploy; watch kubectl for completion.
   */
  mode: 'complete' | 'trigger';
  /**
   * "deployment"  — uses `kubectl rollout status deployment/<name>` (default)
   * "argo-rollout" — uses `kubectl argo rollouts status <name>` (Argo Rollouts CRD)
   */
  kubectlResourceType?: 'deployment' | 'argo-rollout';
  /** Resource name to watch (required when mode = "trigger") */
  kubectlDeployment?: string;
  /** kubectl namespace (required when mode = "trigger") */
  kubectlNamespace?: string;
}

export interface GitHubActionsDeployConfig {
  token: string;
}

export interface KubectlConfig {
  /** If set, passes --context to every kubectl call. Defaults to current-context. */
  context?: string;
}

/** Field-level defaults applied before per-service values. */
export interface DeployDefaults {
  owner?: string;
  workflow?: string;
  mode?: 'complete' | 'trigger';
  kubectlResourceType?: 'deployment' | 'argo-rollout';
}

export interface DeploysConfig {
  provider: 'github-actions' | 'none';
  github?: GitHubActionsDeployConfig;
  kubectl?: KubectlConfig;
  defaults?: DeployDefaults;
  /** service key (same keys as parity.svc_map values) → per-service CI config */
  services: Record<string, DeployServiceConfig>;
}

export interface MetricsConfig {
  provider: 'none';
}

export interface SlackConfig {
  /** Slack user token (xoxp-…) with search:read — bot tokens can't use search.messages. */
  userToken: string;
  /** Slack Web API base. Defaults to https://slack.com/api. */
  base: string;
}

/**
 * Identity + team lists for the previous-workday report. Mirrors the constants
 * the standup-prep skill hardcodes, moved into config.
 */
export interface ReportConfig {
  /** Jira project key used in the activity JQL (e.g. "COP"). */
  jiraProject: string;
  /** Jira accountId for assignee/reporter/watcher JQL. */
  jiraAccountId: string;
  /** GitHub login for the Actions actor filter (e.g. "wasche"). */
  githubLogin: string;
  /** Slack user id (e.g. "U030BD5RDDF") for mention/self-message search. */
  slackUserId: string;
  /** GitHub org owning the service/library repos (e.g. "gopuff"). */
  githubOrg: string;
  /** Deployable service repo slugs — GHA runs here classify as service releases. */
  teamServices: string[];
  /** Library repo slugs — GHA runs here classify as jar publishes. */
  libraryRepos: string[];
  /** Release channel name for Slack search, without leading '#'. */
  releaseChannel: string;
  /** Release bot username whose "Deployed …" posts corroborate a release. */
  releaseBot: string;
  /** Reaction names (no colons) used as the release-ownership backstop. */
  reactionEmojis: string[];
  /** GitHub token for the Actions sweep. Falls back to deploys.github.token. */
  githubToken?: string;
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
  slack?: SlackConfig;
  report?: ReportConfig;
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
  /** True when a parity epic is configured — controls the Parity nav tab. */
  parityEnabled: boolean;
  /** True when the previous-workday report is fully configured — controls the Report nav tab. */
  reportEnabled: boolean;
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

// ---- Previous-workday report ------------------------------------------------

export type ReportItemKind = 'jira' | 'release' | 'jar-publish' | 'slack';

export interface ReportItem {
  kind: ReportItemKind;
  /** Jira issue key (kind='jira'). */
  key?: string;
  /** Jira summary (kind='jira'). */
  summary?: string;
  /** Jira status (kind='jira'). */
  status?: string;
  /** Service name (kind='release') or library repo (kind='jar-publish'). */
  repo?: string;
  /** Number of successful publish runs (kind='jar-publish'). */
  count?: number;
  /** Link to a GHA run (release/jar-publish) or Slack permalink (slack). */
  url?: string;
  /** Free-text detail (kind='slack'). */
  text?: string;
  /** ISO timestamp of the underlying event, when known. */
  at?: string;
}

export interface ReportGroup {
  /** Epic name, or a service name for Slack-only items with no epic. */
  name: string;
  /** Jira epic key, when this group corresponds to an epic. */
  epicKey?: string;
  items: ReportItem[];
}

export interface WorkdayReport {
  /** YYYY-MM-DD start of the reported workday (inclusive). */
  startDate: string;
  /** YYYY-MM-DD end of the reported workday (inclusive). */
  endDate: string;
  /** True when the reported workday is a Friday (no service releases labeled). */
  isFriday: boolean;
  groups: ReportGroup[];
  /** Pre-formatted Slack draft text for copy-to-clipboard. */
  slackText: string;
  /** Non-fatal issues (e.g. Slack scope failure) — rendered as a banner. */
  warnings: string[];
}
