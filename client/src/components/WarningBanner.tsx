const MONO = '"JetBrains Mono", monospace';

interface Props {
  children: React.ReactNode;
}

/** Non-fatal advisory banner — shared by the dashboard, report, and pipeline pages. */
export default function WarningBanner({ children }: Props) {
  return (
    <div
      className="border flex items-center"
      style={{
        borderColor: 'var(--c-warn-border, #b45309)',
        backgroundColor: 'var(--c-warn-bg, rgba(245, 158, 11, 0.08))',
        color: 'var(--c-warn, #f59e0b)',
        fontFamily: MONO,
        fontSize: 13,
        padding: '8px 14px',
        marginBottom: 10,
        gap: 10,
      }}
      role="status"
    >
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </div>
  );
}
