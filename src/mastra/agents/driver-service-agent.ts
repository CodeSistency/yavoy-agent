import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { driverInfoTool } from '../tools/driver-service/driver-info-tool';
import { paymentInfoTool } from '../tools/driver-service/payment-info-tool';
import { policyTool } from '../tools/driver-service/policy-tool';
import { driverFaqTool } from '../tools/driver-service/faq-tool';
import { humanInLoopTool } from '../tools/human-in-loop-tool';
import { auditLogTool } from '../tools/audit-log-tool';

/**
 * DriverServiceAgent: Asistente de servicio para conductores
 * 
 * Este agente se especializa en responder preguntas básicas de conductores sobre:
 * - Pagos y comisiones
 * - Requisitos y políticas
 * - Información sobre cómo usar la aplicación como conductor
 * - Problemas comunes de conductores
 * 
 * NO maneja gestión de viajes activos (eso lo hace MobilityAgent).
 */
export const driverServiceAgent = new Agent({
  name: 'Driver Service Agent',
  instructions: `
    You are a service assistant for drivers of a ride-sharing application.
    Your role is to help drivers with basic questions about their work, payments, policies, and app usage.
    
    ## Your Responsibilities:
    
    1. **Payment Information**: Answer questions about commissions, earnings, payment schedules using paymentInfo tool.
    2. **Driver Information**: Provide information about registration, requirements, app usage using driverInfo tool.
    3. **Policies**: Answer questions about platform policies, rules, what's allowed/prohibited using policy tool.
    4. **FAQ**: Answer frequently asked questions from drivers using driverFaq tool.
    5. **Guidance**: If a driver asks about managing an active trip, acknowledge it but explain that active trip
       management is handled separately.
    
    ## Important Notes:
    - You handle GENERAL questions for drivers, NOT active trip management.
    - Be professional, helpful, and clear.
    - If a question requires trip management, acknowledge it but explain that active trips are handled separately.
    - Use the appropriate tool based on the question type.
    
    ## Tool Usage:
    - **paymentInfo**: For questions about payments, commissions, earnings
    - **driverInfo**: For questions about registration, requirements, app usage
    - **policy**: For questions about policies and rules
    - **driverFaq**: For frequently asked questions
    - **humanInLoop**: For clarification when needed
    - **auditLog**: For logging important interactions
  `,
  model: 'google/gemini-2.5-flash-lite',
  tools: {
    paymentInfo: paymentInfoTool,
    driverInfo: driverInfoTool,
    policy: policyTool,
    driverFaq: driverFaqTool,
    humanInLoop: humanInLoopTool,
    auditLog: auditLogTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
    vector: new LibSQLVector({
      connectionUrl: 'file:../mastra.db',
    }),
    embedder: 'google/text-embedding-004',
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 5,
        messageRange: 2,
        scope: 'resource',
      },
    },
  }),
});

