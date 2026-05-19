import type { Workstream } from '../../../shared/types.ts';
import { useConfig, useTicketUrl } from '../lib/config-context.ts';
import { buildParityMatrix } from '../lib/parity.ts';

interface Props {
  workstream: Workstream;
}

export default function ParityMatrix({ workstream }: Props) {
  const { parity } = useConfig();
  const ticketUrl = useTicketUrl();
  const { services, modules, cells } = buildParityMatrix(workstream, parity);

  if (services.length === 0) {
    return (
      <div
        className="px-6 py-6 text-center text-neutral-700 text-xs italic"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
      >
        no matrix data — assign issues to a mapped component and add a mapped label
      </div>
    );
  }

  const naOf = (svc: string): Set<string> => new Set(parity.na[svc] || []);

  const doneCount = services.reduce(
    (s, svc) =>
      s + modules.filter((m) => !naOf(svc).has(m) && cells[svc]?.[m]?.resolutiondate).length,
    0,
  );
  const total = services.reduce((s, svc) => s + modules.filter((m) => !naOf(svc).has(m)).length, 0);

  return (
    <div>
      <div className="px-6 py-3 border-b border-neutral-900 flex items-center justify-between">
        <span
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          className="text-[10px] uppercase tracking-[0.25em] text-neutral-600"
        >
          service parity matrix
        </span>
        <span
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          className="text-[11px] text-neutral-600"
        >
          <span className="text-emerald-400">{doneCount}</span>
          {`/${total} done`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          <thead>
            <tr className="border-b border-neutral-900">
              <th className="text-left px-6 py-2.5 text-[10px] uppercase tracking-widest text-neutral-600 font-normal">
                service
              </th>
              {modules.map((m) => (
                <th
                  key={m}
                  className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-neutral-600 font-normal text-center whitespace-nowrap"
                >
                  {parity.modMap[m] || m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((svc, si) => {
              const naSet = naOf(svc);
              const applicable = modules.filter((m) => !naSet.has(m));
              const svcDone = applicable.filter((m) => cells[svc]?.[m]?.resolutiondate).length;
              const svcTotal = applicable.length;
              return (
                <tr
                  key={svc}
                  className={`border-b border-neutral-900/50 transition-colors hover:bg-neutral-900/20 ${si % 2 === 1 ? 'bg-neutral-950/30' : ''}`}
                >
                  <td className="px-6 py-2 text-xs text-neutral-300 whitespace-nowrap">
                    <div>{svc}</div>
                    <div className="text-neutral-700 text-[10px] mt-0.5 tabular-nums">
                      {`${svcDone}/${svcTotal}`}
                    </div>
                  </td>
                  {modules.map((mod) => {
                    if (naSet.has(mod)) {
                      return (
                        <td
                          key={mod}
                          className="px-4 py-2 text-center text-neutral-800 text-[10px] uppercase tracking-wider"
                        >
                          n/a
                        </td>
                      );
                    }
                    const issue = cells[svc]?.[mod];
                    if (!issue) {
                      return (
                        <td key={mod} className="px-4 py-2 text-center text-neutral-800 text-xs">
                          —
                        </td>
                      );
                    }
                    if (issue.resolutiondate) {
                      return (
                        <td key={mod} className="px-4 py-2 text-center">
                          <a
                            href={ticketUrl(issue.key, workstream.key)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={issue.key}
                            className="inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wider bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 transition-colors hover:bg-emerald-900/50"
                          >
                            done
                          </a>
                        </td>
                      );
                    }
                    const inProg =
                      issue.status.toLowerCase().includes('progress') ||
                      issue.status.toLowerCase().includes('review');
                    return (
                      <td key={mod} className="px-4 py-2 text-center">
                        <a
                          href={ticketUrl(issue.key, workstream.key)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={issue.key}
                          className={`text-[11px] transition-colors hover:underline ${inProg ? 'text-amber-400' : 'text-neutral-500'}`}
                        >
                          {issue.key}
                        </a>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
