import type { SlackConfig } from '../../shared/types.ts';
import type { DateWindow } from './dateWindow.ts';

export interface SlackMatch {
  text: string;
  permalink: string;
  channel: string;
  username: string;
  ts: string;
}

export interface SlackSignals {
  /** Release-bot "Deployed …" posts in the release channel (corroboration). */
  releasePosts: SlackMatch[];
  /** Messages that tag the user. */
  mentions: SlackMatch[];
  /** Release-celebration reactions by the user (ownership backstop). */
  reactions: SlackMatch[];
  /** The user's own notable messages. */
  selfMessages: SlackMatch[];
  /** Non-fatal problems (missing scope, bad token, unparsable query). */
  warnings: string[];
}

interface SlackSearchResponse {
  ok: boolean;
  error?: string;
  messages?: {
    matches?: Array<{
      text?: string;
      permalink?: string;
      ts?: string;
      username?: string;
      channel?: { name?: string };
    }>;
  };
}

/**
 * Slack date qualifier for a window. Slack's `after:`/`before:` are exclusive,
 * so widen by a day on each side; a single-day window uses `on:`.
 */
function dateQualifier(window: DateWindow): string {
  if (window.startDate === window.endDate) return `on:${window.startDate}`;
  const before = new Date(`${window.startDate}T00:00:00`);
  before.setDate(before.getDate() - 1);
  const after = new Date(`${window.endDate}T00:00:00`);
  after.setDate(after.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `after:${fmt(before)} before:${fmt(after)}`;
}

export class SlackReportClient {
  private readonly token: string;
  private readonly base: string;

  constructor(cfg: SlackConfig) {
    this.token = cfg.userToken;
    this.base = cfg.base;
  }

  /** Run one search.messages query. Throws on ok:false so callers can degrade. */
  private async search(query: string): Promise<SlackMatch[]> {
    const qs = new URLSearchParams({ query, count: '20', sort: 'timestamp' });
    const r = await fetch(`${this.base}/search.messages?${qs}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!r.ok) throw new Error(`Slack HTTP ${r.status}`);
    const body = (await r.json()) as SlackSearchResponse;
    if (!body.ok) throw new Error(body.error ?? 'unknown error');
    return (body.messages?.matches ?? []).map((m) => ({
      text: m.text ?? '',
      permalink: m.permalink ?? '',
      channel: m.channel?.name ?? '',
      username: m.username ?? '',
      ts: m.ts ?? '',
    }));
  }

  /**
   * Gather the standup-prep Step 2 Slack signals. Every query is best-effort:
   * a failure (e.g. token missing search:read) records a warning and yields an
   * empty result rather than failing the whole report.
   */
  async gather(
    window: DateWindow,
    opts: { releaseChannel: string; releaseBot: string; userId: string; reactions: string[] },
  ): Promise<SlackSignals> {
    const when = dateQualifier(window);
    const warnings: string[] = [];

    const run = async (label: string, query: string): Promise<SlackMatch[]> => {
      try {
        return await this.search(query);
      } catch (e) {
        warnings.push(`Slack ${label} search failed: ${(e as Error).message}`);
        return [];
      }
    };

    const channelQual = opts.releaseChannel ? `in:#${opts.releaseChannel} ` : '';
    const [releasePosts, mentions, selfMessages, ...reactionResults] = await Promise.all([
      run('release-posts', `${channelQual}Deployed ${when}`),
      run('mentions', `<@${opts.userId}> ${when}`),
      run('self-messages', `from:<@${opts.userId}> ${when}`),
      ...opts.reactions.map((emoji) => run('reaction', `hasmy:${emoji} ${when}`)),
    ]);

    return {
      releasePosts,
      mentions,
      reactions: reactionResults.flat(),
      selfMessages,
      warnings,
    };
  }
}
