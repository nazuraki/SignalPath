import { describe, expect, it, vi } from 'vitest';
import type { SlackMatch, SlackReportClient } from '../report/slack.ts';
import { SlackReleaseFinder } from './slackRelease.ts';

const match = (overrides: Partial<SlackMatch> = {}): SlackMatch => ({
  text: 'New release published: repo-a v1.2.3',
  permalink: 'https://slack/archives/C1/p1',
  channel: 'development-release',
  username: 'SRE-releasebot',
  ts: '1735689600.000100',
  ...overrides,
});

const opts = { channel: 'development-release', match: 'New release published', ttlSeconds: 120 };

/** A stub client exposing only the method the finder uses. */
const client = (impl: () => Promise<SlackMatch[]>): SlackReportClient =>
  ({ searchMessages: vi.fn(impl) }) as unknown as SlackReportClient;

describe('SlackReleaseFinder', () => {
  it('scopes the query to the release channel and the match phrase', async () => {
    const c = client(() => Promise.resolve([match()]));
    await new SlackReleaseFinder(c, opts).find('service-a', 'repo-a');
    expect(c.searchMessages).toHaveBeenCalledWith(
      'in:#development-release "New release published" service-a',
      10,
    );
  });

  it('omits the channel qualifier when no release channel is configured', async () => {
    const c = client(() => Promise.resolve([]));
    await new SlackReleaseFinder(c, { ...opts, channel: '' }).find('service-a');
    expect(c.searchMessages).toHaveBeenCalledWith('"New release published" service-a', 10);
  });

  it('returns the newest post naming the service, with an ISO timestamp', async () => {
    const c = client(() => Promise.resolve([match()]));
    const { link } = await new SlackReleaseFinder(c, opts).find('service-a', 'repo-a');
    expect(link).toEqual({
      url: 'https://slack/archives/C1/p1',
      text: 'New release published: repo-a v1.2.3',
      at: '2025-01-01T00:00:00.000Z',
    });
  });

  it('matches on the repo slug when the post does not name the service key', async () => {
    const c = client(() => Promise.resolve([match({ text: 'New release published: repo-a v9' })]));
    const { link } = await new SlackReleaseFinder(c, opts).find('service-a', 'repo-a');
    expect(link?.url).toBe('https://slack/archives/C1/p1');
  });

  it('skips posts that name neither the service nor the repo', async () => {
    const c = client(() =>
      Promise.resolve([
        match({ text: 'New release published: other-service v1' }),
        match({ text: 'New release published: repo-a v2', permalink: 'https://slack/p2' }),
      ]),
    );
    const { link } = await new SlackReleaseFinder(c, opts).find('service-a', 'repo-a');
    expect(link?.url).toBe('https://slack/p2');
  });

  it('returns a null link with no warning when nothing matches', async () => {
    const c = client(() => Promise.resolve([]));
    expect(await new SlackReleaseFinder(c, opts).find('service-a')).toEqual({ link: null });
  });

  it('turns a search failure into a warning rather than throwing', async () => {
    const c = client(() => Promise.reject(new Error('missing_scope')));
    const { link, warning } = await new SlackReleaseFinder(c, opts).find('service-a');
    expect(link).toBeNull();
    expect(warning).toBe('Slack release lookup for "service-a" failed: missing_scope');
  });

  it('serves a cached permalink inside the TTL', async () => {
    const c = client(() => Promise.resolve([match()]));
    let clock = 1_000_000;
    const finder = new SlackReleaseFinder(c, opts, () => clock);

    await finder.find('service-a', 'repo-a');
    clock += 119_000;
    const { link } = await finder.find('service-a', 'repo-a');

    expect(c.searchMessages).toHaveBeenCalledTimes(1);
    expect(link?.url).toBe('https://slack/archives/C1/p1');
  });

  it('searches again once the TTL expires', async () => {
    const c = client(() => Promise.resolve([match()]));
    let clock = 1_000_000;
    const finder = new SlackReleaseFinder(c, opts, () => clock);

    await finder.find('service-a', 'repo-a');
    clock += 121_000;
    await finder.find('service-a', 'repo-a');

    expect(c.searchMessages).toHaveBeenCalledTimes(2);
  });

  it('caches a miss too, so a service with no post is not re-searched every poll', async () => {
    const c = client(() => Promise.resolve([]));
    const finder = new SlackReleaseFinder(c, opts, () => 5_000);
    await finder.find('service-a');
    await finder.find('service-a');
    expect(c.searchMessages).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failure — a transient error should be retried', async () => {
    const c = client(() => Promise.reject(new Error('ratelimited')));
    const finder = new SlackReleaseFinder(c, opts, () => 5_000);
    await finder.find('service-a');
    await finder.find('service-a');
    expect(c.searchMessages).toHaveBeenCalledTimes(2);
  });

  it('caches per service key', async () => {
    const c = client(() => Promise.resolve([match()]));
    const finder = new SlackReleaseFinder(c, opts, () => 5_000);
    await finder.find('service-a');
    await finder.find('service-b');
    expect(c.searchMessages).toHaveBeenCalledTimes(2);
  });
});
