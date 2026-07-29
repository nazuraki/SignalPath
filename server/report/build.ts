import type { ReportGroup, ReportItem, WorkdayReport } from '../../shared/types.ts';
import type { DateWindow } from './dateWindow.ts';
import type { GithubSweep } from './github.ts';
import type { JiraActivityItem } from './jira.ts';
import type { SlackSignals } from './slack.ts';

export interface BuildInput {
  window: DateWindow;
  jiraItems: JiraActivityItem[];
  github: GithubSweep;
  slack: SlackSignals;
  /** Jira base URL for hyperlinking ticket keys in the Slack draft. */
  jiraBase: string;
}

const RELEASES_GROUP = 'Releases & jar publishes';
const SLACK_GROUP = 'Slack activity';
const MAX_SLACK_ITEMS = 8;

/** First line of a message, collapsed and trimmed for a one-line bullet. */
function oneLine(text: string, max = 120): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/**
 * Assemble gathered signals into a WorkdayReport. Pure — no I/O — so the
 * grouping, the Friday rule, and the Slack-draft formatting are unit-testable.
 *
 * The Friday rule (standup-prep Step 4): service releases can't happen on a
 * Friday, so on a Friday window release runs are surfaced as neutral "deploy
 * activity" and a warning is added rather than labeling them releases.
 */
export function buildReport(input: BuildInput): WorkdayReport {
  const { window, jiraItems, github, slack, jiraBase } = input;
  const warnings = [...slack.warnings];
  const groups: ReportGroup[] = [];

  // --- Jira, grouped by epic (first-seen order) ---
  const epicOrder: string[] = [];
  const epicGroups = new Map<string, ReportGroup>();
  for (const it of jiraItems) {
    const name = it.epicName ?? 'No epic';
    let g = epicGroups.get(name);
    if (!g) {
      g = { name, epicKey: it.epicKey, items: [] };
      epicGroups.set(name, g);
      epicOrder.push(name);
    }
    g.items.push({ kind: 'jira', key: it.key, summary: it.summary, status: it.status });
  }
  for (const name of epicOrder) {
    const g = epicGroups.get(name);
    if (g) groups.push(g);
  }

  // --- Releases + jar publishes ---
  const releaseItems: ReportItem[] = [
    ...github.releases.map(
      (r): ReportItem => ({ kind: 'release', repo: r.repo, text: r.version, url: r.url, at: r.at }),
    ),
    ...github.jarPublishes.map(
      (j): ReportItem => ({ kind: 'jar-publish', repo: j.repo, count: j.count, url: j.url }),
    ),
  ];
  if (window.isFriday && github.releases.length > 0) {
    warnings.push(
      'Reported workday is a Friday — service releases do not happen on Fridays; ' +
        'GitHub deploy runs are shown as activity, not releases.',
    );
  }
  if (releaseItems.length > 0) {
    groups.push({ name: RELEASES_GROUP, items: releaseItems });
  }

  // --- Slack activity (mentions + self messages, deduped) ---
  const seen = new Set<string>();
  const slackItems: ReportItem[] = [];
  for (const m of [...slack.mentions, ...slack.selfMessages]) {
    const link = m.permalink;
    if (link && seen.has(link)) continue;
    if (link) seen.add(link);
    slackItems.push({ kind: 'slack', text: m.text, url: m.permalink, at: m.ts });
    if (slackItems.length >= MAX_SLACK_ITEMS) break;
  }
  if (slackItems.length > 0) {
    groups.push({ name: SLACK_GROUP, items: slackItems });
  }

  return {
    startDate: window.startDate,
    endDate: window.endDate,
    isFriday: window.isFriday,
    groups,
    slackText: formatSlackText(groups, window, jiraBase),
    warnings,
  };
}

/** Render the report as a pasteable Slack draft in the standup-prep style. */
function formatSlackText(groups: ReportGroup[], window: DateWindow, jiraBase: string): string {
  const ticketLink = (key: string): string =>
    jiraBase ? `<${jiraBase}/browse/${key}|${key}>` : key;

  if (groups.length === 0) {
    return `No activity found for ${window.startDate}.`;
  }

  const sections = groups.map((g) => {
    let header: string;
    if (g.name === RELEASES_GROUP || g.name === SLACK_GROUP) {
      header = `_${g.name}_`;
    } else if (g.epicKey) {
      header = `_${g.name} (${ticketLink(g.epicKey)})_`;
    } else {
      header = `_${g.name}_`;
    }

    const lines = g.items.map((it) => {
      switch (it.kind) {
        case 'jira':
          return `• ${it.summary} — ${ticketLink(it.key ?? '')} (${it.status})`;
        case 'release':
          return window.isFriday
            ? `• deploy activity on *${it.repo}*${it.text ? ` ${it.text}` : ''}`
            : `• released *${it.repo}*${it.text ? ` ${it.text}` : ''}`;
        case 'jar-publish':
          return `• published ${it.count} updated jar${it.count === 1 ? '' : 's'} — *${it.repo}*`;
        case 'slack':
          return `• ${oneLine(it.text ?? '')}${it.url ? ` <${it.url}>` : ''}`;
        default:
          return '•';
      }
    });

    return `${header}\n\n${lines.join('\n')}`;
  });

  return sections.join('\n\n');
}
