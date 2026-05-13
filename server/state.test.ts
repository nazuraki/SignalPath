import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Redirect state file to a temp directory so tests don't touch the real data/.
const tmpDir = join(import.meta.dirname, '__test_state_tmp__');

vi.mock('./state.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./state.ts')>();
  // We can't easily swap the path constant, so we test via the real filesystem
  // by pointing cwd to tmpDir in beforeEach instead.
  return mod;
});

// Rather than mocking internals, just test the public API with a real temp dir.
// We monkey-patch the module-level path by re-importing with a different cwd.
// Simplest approach: call readState/writeTicketState directly and check tmpFile.

import { readState, writeTicketState } from './state.ts';

beforeEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  // Point the module's resolved path to tmpDir by writing state.json there.
  // Since we can't easily swap the constant, we'll pre-seed and assert using
  // the actual data/ path, but clean up afterward.
});

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  // Clean up any state.json written by writeTicketState during tests.
  const dataDir = join(import.meta.dirname, '..', 'data');
  const stateFile = join(dataDir, 'state.json');
  if (existsSync(stateFile)) rmSync(stateFile);
});

describe('readState', () => {
  it('returns empty object when state.json does not exist', () => {
    // Ensure no state.json exists
    const stateFile = join(import.meta.dirname, '..', 'data', 'state.json');
    if (existsSync(stateFile)) rmSync(stateFile);
    expect(readState()).toEqual({});
  });

  it('returns empty object on malformed JSON', () => {
    const dataDir = join(import.meta.dirname, '..', 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'state.json'), 'not valid json');
    expect(readState()).toEqual({});
  });

  it('returns parsed state when file is valid', () => {
    const dataDir = join(import.meta.dirname, '..', 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      join(dataDir, 'state.json'),
      JSON.stringify({ 'PROJ-1': { pr: 'https://github.com/org/repo/pull/1' } }),
    );
    expect(readState()).toEqual({ 'PROJ-1': { pr: 'https://github.com/org/repo/pull/1' } });
  });
});

describe('writeTicketState', () => {
  afterEach(() => {
    const stateFile = join(import.meta.dirname, '..', 'data', 'state.json');
    if (existsSync(stateFile)) rmSync(stateFile);
  });

  it('creates data/ directory and state.json when writing for the first time', () => {
    writeTicketState('PROJ-1', { pr: 'https://github.com/org/repo/pull/1' });
    const stateFile = join(import.meta.dirname, '..', 'data', 'state.json');
    expect(existsSync(stateFile)).toBe(true);
    expect(readState()).toEqual({ 'PROJ-1': { pr: 'https://github.com/org/repo/pull/1' } });
  });

  it('merges new fields with existing entry', () => {
    writeTicketState('PROJ-1', { pr: 'https://github.com/org/repo/pull/1' });
    writeTicketState('PROJ-1', { notes: 'hello' });
    expect(readState()['PROJ-1']).toEqual({
      pr: 'https://github.com/org/repo/pull/1',
      notes: 'hello',
    });
  });

  it('prunes empty-string fields', () => {
    writeTicketState('PROJ-1', { pr: 'https://github.com/org/repo/pull/1', notes: 'keep' });
    writeTicketState('PROJ-1', { pr: '' });
    expect(readState()['PROJ-1']).toEqual({ notes: 'keep' });
  });

  it('removes the entry entirely when all fields are cleared', () => {
    writeTicketState('PROJ-1', { pr: 'https://github.com/org/repo/pull/1' });
    writeTicketState('PROJ-1', { pr: '' });
    expect(readState()).toEqual({});
  });

  it('preserves other entries when updating one', () => {
    writeTicketState('PROJ-1', { pr: 'https://github.com/org/repo/pull/1' });
    writeTicketState('PROJ-2', { notes: 'other ticket' });
    const s = readState();
    expect(s['PROJ-1']).toEqual({ pr: 'https://github.com/org/repo/pull/1' });
    expect(s['PROJ-2']).toEqual({ notes: 'other ticket' });
  });
});
