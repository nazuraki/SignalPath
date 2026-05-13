# Adding a Provider

Providers are thin adapters that translate a third-party system into SignalPath's shared types.

## Steps

### 1. Implement the interface

Create `server/providers/<category>/<name>.ts` and implement the relevant interface from `types.ts`.

Example for a new ticket provider:

```typescript
// server/providers/tickets/linear.ts
import type { Workstream } from '../../../shared/types.ts';
import type { TicketProvider } from '../types.ts';

export class LinearTicketProvider implements TicketProvider {
  constructor(private readonly cfg: LinearTicketConfig) {}

  async fetchWorkstreams(): Promise<Workstream[]> {
    // call Linear GraphQL API, map results to Workstream[]
  }
}
```

### 2. Add config types

Add the provider-specific config shape to `shared/types.ts` (e.g. `LinearTicketConfig`) and extend the relevant `*Config` union (e.g. `TicketsConfig`).

### 3. Register the provider

Add a `case` to the matching factory in `server/providers/registry.ts`:

```typescript
case 'linear':
  if (!cfg.linear) throw new Error('tickets.provider = "linear" but [tickets.linear] is missing');
  return new LinearTicketProvider(cfg.linear);
```

### 4. Update config parsing

Add the new TOML key to `RawConfig` in `server/config.ts` and map it into `ServerConfig`.

### 5. Document the config shape

Add an example block to `config.example.toml` showing all required and optional keys.

### 6. Write tests

Add `server/providers/<category>/<name>.test.ts`. Mock `fetch` with `vi.stubGlobal` and verify:
- Happy-path mapping from API response to shared types
- Error handling on non-2xx responses
- Any edge cases specific to the provider (pagination, missing fields, etc.)
