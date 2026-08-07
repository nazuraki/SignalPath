import type { ReleaseLink } from '../../shared/types.ts';
import type { SlackMatch, SlackReportClient } from '../report/slack.ts';

export interface SlackReleaseResult {
  link: ReleaseLink | null;
  /** Set when the lookup failed; surfaced as a page warning rather than an error. */
  warning?: string;
}

interface CacheEntry {
  at: number;
  link: ReleaseLink | null;
}

export interface SlackReleaseOptions {
  /** Release channel name, without the leading '#'. */
  channel: string;
  /** Text to match in the announcement, e.g. "New release published". */
  match: string;
  /** Seconds to hold a resolved permalink before searching again. */
  ttlSeconds: number;
}

/** Slack `ts` is epoch seconds with a fractional part; ISO is friendlier downstream. */
function tsToIso(ts: string): string | undefined {
  const seconds = Number.parseFloat(ts);
  if (!Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1000).toISOString();
}

/** First line of the post, collapsed — the full text is behind the permalink. */
function label(text: string, max = 90): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line) return 'release post';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/**
 * Resolves the newest release-announcement post for a service.
 *
 * Slack's search.messages is slow and rate-limited (tier 2), and the pipeline page
 * re-polls while a rollout is live, so resolved permalinks are cached per service
 * for `ttlSeconds`. Failures never propagate — they come back as warnings.
 */
export class SlackReleaseFinder {
  private readonly client: SlackReportClient;
  private readonly opts: SlackReleaseOptions;
  private readonly now: () => number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(client: SlackReportClient, opts: SlackReleaseOptions, now: () => number = Date.now) {
    this.client = client;
    this.opts = opts;
    this.now = now;
  }

  async find(svcKey: string, repo?: string): Promise<SlackReleaseResult> {
    const cached = this.cache.get(svcKey);
    if (cached && this.now() - cached.at < this.opts.ttlSeconds * 1000) {
      return { link: cached.link };
    }

    const channelQual = this.opts.channel ? `in:#${this.opts.channel} ` : '';
    const query = `${channelQual}"${this.opts.match}" ${svcKey}`;

    let matches: SlackMatch[];
    try {
      matches = await this.client.searchMessages(query, 10);
    } catch (e) {
      return {
        link: null,
        warning: `Slack release lookup for "${svcKey}" failed: ${(e as Error).message}`,
      };
    }

    // search.messages sorts newest-first, so the first text match is the latest
    // release. Both the service key and the repo slug are checked because the
    // announcement may name either.
    const needles = [svcKey, repo]
      .filter((n): n is string => Boolean(n))
      .map((n) => n.toLowerCase());
    const hit = matches.find((m) => {
      const text = m.text.toLowerCase();
      return needles.some((n) => text.includes(n));
    });

    const link: ReleaseLink | null = hit?.permalink
      ? { url: hit.permalink, text: label(hit.text), at: tsToIso(hit.ts) }
      : null;

    this.cache.set(svcKey, { at: this.now(), link });
    return { link };
  }
}
