import type { ServerConfig, WorkdayReport } from '../../shared/types.ts';
import { JiraClient } from '../providers/tickets/jira-client.ts';
import { buildReport } from './build.ts';
import { previousWorkday } from './dateWindow.ts';
import { sweepGithub } from './github.ts';
import { fetchJiraActivity } from './jira.ts';
import { SlackReportClient } from './slack.ts';

/** True when the report has everything it needs: [report], [slack], Jira creds. */
export function isReportEnabled(config: ServerConfig): boolean {
  return Boolean(
    config.report?.jiraAccountId &&
      config.slack?.userToken &&
      config.tickets.jira?.email &&
      config.tickets.jira?.apiToken,
  );
}

/**
 * Gather Jira activity, GitHub Actions releases/jar-publishes, and Slack signals
 * for the previous workday (or `dateOverride`) and assemble a WorkdayReport.
 * Each source degrades independently: Slack failures become warnings, a bad
 * GitHub repo slug is skipped, and only Jira is required (guaranteed enabled).
 */
export async function generateReport(
  config: ServerConfig,
  now: Date,
  dateOverride?: string,
): Promise<WorkdayReport> {
  const report = config.report;
  const jira = config.tickets.jira;
  const slackCfg = config.slack;
  if (!report || !jira || !slackCfg) {
    throw new Error('report is not configured');
  }

  const window = previousWorkday(now, dateOverride);

  const jiraClient = new JiraClient(jira.base, jira.email, jira.apiToken);
  const githubToken = report.githubToken ?? config.deploys.github?.token ?? '';

  const [jiraItems, github, slack] = await Promise.all([
    fetchJiraActivity(jiraClient, report.jiraProject, report.jiraAccountId, window),
    githubToken
      ? sweepGithub(
          githubToken,
          report.githubOrg,
          report.githubLogin,
          report.teamServices,
          report.libraryRepos,
          window,
        )
      : Promise.resolve({ releases: [], jarPublishes: [] }),
    new SlackReportClient(slackCfg).gather(window, {
      releaseChannel: report.releaseChannel,
      releaseBot: report.releaseBot,
      userId: report.slackUserId,
      reactions: report.reactionEmojis,
    }),
  ]);

  if (!githubToken) {
    slack.warnings.push('No GitHub token configured — releases and jar publishes were skipped.');
  }

  return buildReport({ window, jiraItems, github, slack, jiraBase: jira.base });
}
