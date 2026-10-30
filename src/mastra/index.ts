
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';
import { nexoAssist } from '@/agent/nexo-assist';
import { createAgentStore } from './agent-store';


/**
 * Traces are a development tool: Mastra Studio reads them from a local DuckDB
 * file, and hosted functions have a read-only disk. In production the agent
 * memory is the only storage, and the decision log keeps the audit trail.
 */
async function createTelemetry() {
  if (process.env.NODE_ENV === 'production') {
    return { storage: createAgentStore() };
  }

  // Loaded here so production never touches DuckDB's native bindings
  const { DuckDBStore } = await import('@mastra/duckdb');
  return {
    storage: new MastraCompositeStore({
      id: 'composite-storage',
      default: createAgentStore(),
      domains: {
        observability: await new DuckDBStore().getStore('observability'),
      }
    }),
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'mastra',
          exporters: [
            new MastraStorageExporter(), // Persists observability events to Mastra Storage
            new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
          ],
          spanOutputProcessors: [
            new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
          ],
        },
      },
    }),
  };
}

export const mastra = new Mastra({
  agents: { nexoAssist },
  ...(await createTelemetry()),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
