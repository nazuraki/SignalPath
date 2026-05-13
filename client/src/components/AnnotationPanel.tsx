import type { TicketState } from '../../../shared/types.ts';
import { fmtDate } from '../lib/format.ts';

const MONO = { fontFamily: '"JetBrains Mono", monospace' };

export function hasAnnotation(a: TicketState | undefined): boolean {
  return !!a && Object.values(a).some((v) => v !== undefined && v !== '');
}

/** The ▸ toggle button rendered inside the issue row. */
export function AnnotationToggle({
  annotation,
  open,
  onToggle,
}: {
  annotation: TicketState | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const annotated = hasAnnotation(annotation);
  return (
    <button
      type="button"
      onClick={onToggle}
      title={annotated ? 'Edit annotations' : 'Add annotations'}
      className="shrink-0 flex items-center gap-1 text-neutral-700 hover:text-neutral-400 transition-colors"
      style={MONO}
    >
      {annotated && <span className="w-1 h-1 rounded-full bg-amber-400/60 shrink-0" />}
      <span className={`text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
    </button>
  );
}

/** The expanded form rendered below the issue row. */
export function AnnotationForm({
  annotation,
  onSave,
  onCancel,
}: {
  annotation: TicketState | undefined;
  onSave: (patch: Partial<TicketState>) => void;
  onCancel: () => void;
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const deployedAtRaw = fd.get('deployedAt') as string;
    const patch: Partial<TicketState> = {
      pr: (fd.get('pr') as string) || undefined,
      deployAppId: (fd.get('deployAppId') as string) || undefined,
      metricsUrl: (fd.get('metricsUrl') as string) || undefined,
      deployedAt: deployedAtRaw ? new Date(deployedAtRaw).toISOString() : undefined,
      notes: (fd.get('notes') as string) || undefined,
    };
    onSave(patch);
  };

  const defaultDeployedAt = annotation?.deployedAt
    ? new Date(annotation.deployedAt).toISOString().slice(0, 16)
    : '';

  return (
    <form
      onSubmit={handleSubmit}
      className="px-6 py-3 border-t border-neutral-900/60 bg-neutral-950/40"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
        <Field
          name="pr"
          label="PR"
          defaultValue={annotation?.pr}
          placeholder="https://github.com/org/repo/pull/42"
        />
        <Field
          name="deployAppId"
          label="Deploy App ID"
          defaultValue={annotation?.deployAppId}
          placeholder="my-app-prod"
        />
        <Field
          name="metricsUrl"
          label="Metrics URL"
          defaultValue={annotation?.metricsUrl}
          placeholder="https://grafana.example.com/d/abc"
        />
        <div>
          <label
            htmlFor="deployedAt"
            className="block text-[10px] text-neutral-600 mb-1 uppercase tracking-wider"
            style={MONO}
          >
            Deployed At
          </label>
          <input
            id="deployedAt"
            type="datetime-local"
            name="deployedAt"
            defaultValue={defaultDeployedAt}
            className="w-full bg-transparent border border-neutral-800 text-neutral-300 text-xs px-2 py-1 focus:outline-none focus:border-neutral-600"
            style={MONO}
          />
        </div>
        <div className="col-span-2">
          <label
            htmlFor="notes"
            className="block text-[10px] text-neutral-600 mb-1 uppercase tracking-wider"
            style={MONO}
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={annotation?.notes}
            rows={2}
            className="w-full bg-transparent border border-neutral-800 text-neutral-300 text-xs px-2 py-1 focus:outline-none focus:border-neutral-600 resize-none"
            style={MONO}
          />
        </div>
      </div>

      {annotation?.deployedAt && (
        <p className="text-[10px] text-neutral-600 mb-2" style={MONO}>
          last deployed {fmtDate(annotation.deployedAt)}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="text-[10px] uppercase tracking-[0.2em] text-amber-400/70 hover:text-amber-400 transition-colors px-3 py-1.5 border border-amber-400/30 hover:border-amber-400/60"
          style={MONO}
        >
          save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 hover:text-neutral-400 transition-colors"
          style={MONO}
        >
          cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[10px] text-neutral-600 mb-1 uppercase tracking-wider"
        style={MONO}
      >
        {label}
      </label>
      <input
        id={name}
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full bg-transparent border border-neutral-800 text-neutral-300 text-xs px-2 py-1 focus:outline-none focus:border-neutral-600 placeholder-neutral-700"
        style={MONO}
      />
    </div>
  );
}
