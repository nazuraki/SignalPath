import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StateMap, TicketState } from '../shared/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = resolve(ROOT, 'data/state.json');

export function readState(): StateMap {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as StateMap;
  } catch {
    return {};
  }
}

export function writeTicketState(key: string, patch: Partial<TicketState>): StateMap {
  const state = readState();
  const merged: TicketState = { ...state[key], ...patch };

  for (const k of Object.keys(merged) as (keyof TicketState)[]) {
    const v = merged[k];
    if (v === null || v === undefined || v === '') {
      delete merged[k];
    }
  }

  if (Object.keys(merged).length === 0) {
    delete state[key];
  } else {
    state[key] = merged;
  }

  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  return state;
}
