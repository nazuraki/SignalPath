import type { Issue, WorkstreamPair } from '../../../shared/types.ts';

export const hasLOE = (issue: Issue): boolean => typeof issue.points === 'number';

export interface MissingLOECount {
  total: number;
  unresolved: number;
}

export const countMissingLOE = (pairs: WorkstreamPair[]): MissingLOECount => {
  let total = 0;
  let unresolved = 0;
  for (const { workstream } of pairs) {
    for (const issue of workstream.issues || []) {
      if (!hasLOE(issue)) {
        total++;
        if (!issue.resolutiondate) unresolved++;
      }
    }
  }
  return { total, unresolved };
};
