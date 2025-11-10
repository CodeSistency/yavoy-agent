import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { mobilityAgent } from './agents/mobility-agent';

export const mastra = new Mastra({
  agents: { mobilityAgent },
  storage: new LibSQLStore({
    // stores observability, scores, ... into memory storage
    // Using file storage for persistence
    url: 'file:../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'MobilityAgent',
    level: 'info',
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false, 
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true }, 
  },
});
