import type { ReactNode } from 'react';

const MONO = '"JetBrains Mono", monospace';

interface Props {
  loading: boolean;
  error: string | null;
  /** When true, show the spinner/error even if children could render. */
  empty: boolean;
  children: ReactNode;
}

/**
 * Shared burndown load/error gate for the dashboard and parity pages. Renders a
 * spinner while the first fetch is in flight and an error banner on failure,
 * otherwise its children.
 */
export default function DataGate({ loading, error, empty, children }: Props) {
  if (error) {
    return (
      <div
        className="border"
        style={{
          borderColor: 'var(--c-error-border)',
          backgroundColor: 'var(--c-error-bg)',
          color: 'var(--c-error)',
          fontFamily: MONO,
          padding: 20,
        }}
      >
        <div
          className="uppercase tracking-wider opacity-70"
          style={{ fontSize: 13, marginBottom: 6 }}
        >
          load failed
        </div>
        <div className="whitespace-pre-wrap break-words" style={{ fontSize: 15 }}>
          {error}
        </div>
      </div>
    );
  }

  if (loading && empty) {
    return (
      <div
        className="flex flex-col items-center justify-center text-neutral-500"
        style={{ paddingTop: 160, paddingBottom: 160 }}
      >
        <div
          className="border rounded-full animate-spin"
          style={{
            borderColor: 'var(--c-border)',
            borderTopColor: 'var(--c-accent)',
            width: 40,
            height: 40,
            marginBottom: 20,
          }}
        />
        <p className="uppercase tracking-[0.25em]" style={{ fontFamily: MONO, fontSize: 13 }}>
          fetching…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
