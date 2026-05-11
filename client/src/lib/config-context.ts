import { createContext, useContext } from 'react';
import type { ClientConfig } from '../../../shared/types.ts';

export const DEFAULT_CONFIG: ClientConfig = {
  ui: { title: 'Project Orchestrator', subtitle: '' },
  jiraBase: '',
  parity: { epic: null, svcMap: {}, svcLabelMap: {}, modMap: {}, na: {} },
};

export const ConfigContext = createContext<ClientConfig>(DEFAULT_CONFIG);

export const useConfig = (): ClientConfig => useContext(ConfigContext);

export const useJiraUrl = (): ((key: string) => string) => {
  const { jiraBase } = useConfig();
  return (key) => `${jiraBase}/browse/${key}`;
};
