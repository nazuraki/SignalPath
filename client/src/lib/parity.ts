import type { Epic, Issue, ParityConfig } from '../../../shared/types.ts';

export interface ParityMatrix {
  services: string[];
  modules: string[];
  cells: Record<string, Record<string, Issue>>;
}

export const buildParityMatrix = (epic: Epic, parity: ParityConfig): ParityMatrix => {
  const { svcMap, svcLabelMap, modMap } = parity;
  const cells: Record<string, Record<string, Issue>> = {};
  for (const issue of epic.issues || []) {
    const compName = (issue.components || []).find((c) => svcMap[c] !== undefined);
    const svc =
      compName !== undefined
        ? svcMap[compName]
        : (issue.labels || []).map((l) => svcLabelMap[l]).find((s) => s !== undefined);
    if (!svc) continue;
    const modLabel = (issue.labels || []).find((l) => modMap[l] !== undefined);
    if (!modLabel) continue;
    if (!cells[svc]) cells[svc] = {};
    cells[svc][modLabel] = issue;
  }
  const seen = new Set<string>();
  const services: string[] = [];
  for (const svc of [...Object.values(svcMap), ...Object.values(svcLabelMap)]) {
    if (!seen.has(svc)) {
      seen.add(svc);
      services.push(svc);
    }
  }
  return { services, modules: Object.keys(modMap), cells };
};
