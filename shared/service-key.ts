import type { Issue, ParityConfig } from './types.ts';

/**
 * Resolve the deploy-service key an issue belongs to.
 *
 * Components win over labels: `parity.svc_map` maps a component name to a service
 * key, and `parity.svc_label_map` is the fallback for cross-project tickets that
 * can't carry components. Matching is exact (not case-folded) because both maps
 * are keyed by literal Jira component/label names.
 *
 * Returns null when the issue maps to no configured service. The same keys index
 * `deploys.services`, which is the documented contract in config.example.toml.
 */
export function resolveServiceKey(issue: Issue, parity: ParityConfig): string | null {
  const compName = (issue.components || []).find((c) => parity.svcMap[c] !== undefined);
  if (compName !== undefined) return parity.svcMap[compName];
  const byLabel = (issue.labels || [])
    .map((l) => parity.svcLabelMap[l])
    .find((s) => s !== undefined);
  return byLabel ?? null;
}
