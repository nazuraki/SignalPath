import type { Workstream } from '../../../shared/types.ts';
import type { TicketProvider } from '../types.ts';

export class NullTicketProvider implements TicketProvider {
  async fetchWorkstreams(): Promise<Workstream[]> {
    return [];
  }
}
