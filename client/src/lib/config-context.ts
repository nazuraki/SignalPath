import { createContext, useContext } from 'react';
import type { ClientConfig } from '../../../shared/types.ts';

export const DEFAULT_CONFIG: ClientConfig = {
  ui: { title: 'Project Orchestrator', subtitle: '' },
  ticketProvider: 'none',
  ticketBase: '',
  parity: { epic: null, svcMap: {}, svcLabelMap: {}, modMap: {}, na: {} },
};

export const ConfigContext = createContext<ClientConfig>(DEFAULT_CONFIG);

export const useConfig = (): ClientConfig => useContext(ConfigContext);

/**
 * Returns a function that builds the external URL for a ticket.
 * For GitHub, child issue keys (e.g. "#123") need the parent workstream key
 * (e.g. "owner/repo" or "owner/repo#42") to resolve owner/repo. Pass that as
 * the second argument; for workstream-level links it can be omitted.
 */
export const useTicketUrl = (): ((key: string, ctxKey?: string) => string) => {
  const { ticketProvider, ticketBase } = useConfig();
  return (key, ctxKey) => {
    if (!ticketBase) return '#';
    if (ticketProvider === 'jira') {
      return `${ticketBase}/browse/${key}`;
    }
    if (ticketProvider === 'github') {
      // Workstream-level keys: "owner/repo" or "owner/repo#N"
      const wsMatch = key.match(/^([^/#]+\/[^/#]+)(?:#(\d+))?$/);
      if (wsMatch) {
        const [, repo, num] = wsMatch;
        return num ? `${ticketBase}/${repo}/milestone/${num}` : `${ticketBase}/${repo}`;
      }
      // Child issue keys: "#N" — derive owner/repo from ctxKey
      const issueMatch = key.match(/^#(\d+)$/);
      if (issueMatch && ctxKey) {
        const ctxRepo = ctxKey.match(/^([^/#]+\/[^/#]+)/);
        if (ctxRepo) return `${ticketBase}/${ctxRepo[1]}/issues/${issueMatch[1]}`;
      }
      return ticketBase;
    }
    return '#';
  };
};
