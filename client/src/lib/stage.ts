import type { Stage } from '../../../shared/types.ts';

// Stage classification is shared with the server (the /pipeline endpoint filters
// by stage), so the implementation lives in shared/. Re-exported here because the
// client has always imported it from this path.
export { STAGE_ORDER, stageOf } from '../../../shared/stage.ts';
export type { Stage };
