import { useState } from 'react';
import type { ReportGroup, ReportItem } from '../../../shared/types.ts';
import WarningBanner from '../components/WarningBanner.tsx';
import { useTicketUrl } from '../lib/config-context.ts';
import { useReport } from '../lib/report-context.ts';

const MONO = '"JetBrains Mono", monospace';

function ItemLine({ item, ticketUrl }: { item: ReportItem; ticketUrl: (k: string) => string }) {
  if (item.kind === 'jira' && item.key) {
    return (
      <li className="flex items-baseline gap-2" style={{ fontSize: 14, marginBottom: 6 }}>
        <a
          href={ticketUrl(item.key)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 hover:underline whitespace-nowrap"
          style={{ fontFamily: MONO, fontSize: 12 }}
        >
          {item.key}
        </a>
        <span className="text-neutral-300">{item.summary}</span>
        {item.status && (
          <span className="text-neutral-600" style={{ fontFamily: MONO, fontSize: 11 }}>
            ({item.status})
          </span>
        )}
      </li>
    );
  }
  if (item.kind === 'release') {
    return (
      <li style={{ fontSize: 14, marginBottom: 6 }}>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-300 hover:underline"
        >
          <span className="text-emerald-400">{item.repo}</span>
          {item.text ? ` ${item.text}` : ''}
        </a>
      </li>
    );
  }
  if (item.kind === 'jar-publish') {
    return (
      <li style={{ fontSize: 14, marginBottom: 6 }}>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-300 hover:underline"
        >
          {`published ${item.count} updated jar${item.count === 1 ? '' : 's'} — `}
          <span className="text-emerald-400">{item.repo}</span>
        </a>
      </li>
    );
  }
  // slack
  return (
    <li style={{ fontSize: 14, marginBottom: 6 }}>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-neutral-400 hover:underline"
      >
        {item.text || '(message)'}
      </a>
    </li>
  );
}

function Group({ group, ticketUrl }: { group: ReportGroup; ticketUrl: (k: string) => string }) {
  return (
    <section
      className="border"
      style={{
        borderColor: 'var(--c-border)',
        backgroundColor: 'var(--c-bg-card-60)',
        padding: '14px 18px',
        marginBottom: 16,
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <span
          className="uppercase tracking-[0.2em] text-neutral-500"
          style={{ fontFamily: MONO, fontSize: 12 }}
        >
          {group.name}
        </span>
        {group.epicKey && (
          <a
            href={ticketUrl(group.epicKey)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline"
            style={{ fontFamily: MONO, fontSize: 11 }}
          >
            {group.epicKey}
          </a>
        )}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {group.items.map((item, i) => (
          <ItemLine
            key={`${item.kind}-${item.key ?? item.repo ?? item.url ?? i}`}
            item={item}
            ticketUrl={ticketUrl}
          />
        ))}
      </ul>
    </section>
  );
}

export default function ReportPage() {
  const ticketUrl = useTicketUrl();
  const { report, loading, error, date, setDate, run } = useReport();
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    if (!report) return;
    await navigator.clipboard.writeText(report.slackText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section>
      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ paddingLeft: 6, marginBottom: 16 }}
      >
        <div className="flex items-center gap-4">
          <span style={{ width: 8, height: 8, backgroundColor: 'var(--c-accent)' }} />
          <span
            className="uppercase tracking-[0.25em] text-neutral-500"
            style={{ fontFamily: MONO, fontSize: 14 }}
          >
            Previous Workday Report
          </span>
          {report && (
            <span className="text-neutral-600" style={{ fontFamily: MONO, fontSize: 13 }}>
              {report.startDate === report.endDate
                ? report.startDate
                : `${report.startDate} → ${report.endDate}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" style={{ fontFamily: MONO }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border bg-transparent text-neutral-400"
            style={{ borderColor: 'var(--c-border)', fontSize: 13, padding: '6px 10px' }}
            title="Override the reported workday"
          />
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="icon-btn uppercase tracking-[0.2em] text-neutral-500 disabled:opacity-30 border"
            style={{ borderColor: 'var(--c-border)', fontSize: 13, padding: '6px 14px' }}
          >
            {loading ? 'fetching…' : '↻ run'}
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={!report || report.groups.length === 0}
            className="icon-btn uppercase tracking-[0.2em] text-neutral-500 disabled:opacity-30 border"
            style={{ borderColor: 'var(--c-border)', fontSize: 13, padding: '6px 14px' }}
          >
            {copied ? '✓ copied' : 'copy slack text'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="border"
          style={{
            borderColor: 'var(--c-error-border)',
            backgroundColor: 'var(--c-error-bg)',
            color: 'var(--c-error)',
            fontFamily: MONO,
            padding: 16,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {report?.warnings.map((w) => (
        <WarningBanner key={w}>{w}</WarningBanner>
      ))}

      {loading && !report && (
        <div className="text-neutral-600" style={{ fontFamily: MONO, padding: 40, fontSize: 13 }}>
          fetching…
        </div>
      )}

      {!report && !loading && !error && (
        <div
          className="text-center text-neutral-600"
          style={{ fontFamily: MONO, paddingTop: 100, paddingBottom: 100 }}
        >
          <p className="uppercase tracking-widest" style={{ fontSize: 16 }}>
            no report yet
          </p>
          <p className="text-neutral-700" style={{ fontSize: 13, marginTop: 10 }}>
            press run to fetch the previous workday
          </p>
        </div>
      )}

      {report && report.groups.length === 0 && !loading && (
        <div
          className="text-center text-neutral-600"
          style={{ fontFamily: MONO, paddingTop: 100, paddingBottom: 100 }}
        >
          <p className="uppercase tracking-widest" style={{ fontSize: 16 }}>
            no activity found
          </p>
          <p className="text-neutral-700" style={{ fontSize: 13, marginTop: 10 }}>
            {`for ${report.startDate}`}
          </p>
        </div>
      )}

      {report?.groups.map((g) => (
        <Group key={g.name} group={g} ticketUrl={ticketUrl} />
      ))}
    </section>
  );
}
