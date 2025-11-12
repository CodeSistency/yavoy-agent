import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { pricingInfoTool } from '../tools/customer-service/pricing-info-tool';
import { customerFaqTool } from '../tools/customer-service/faq-tool';
import { serviceInfoTool } from '../tools/customer-service/service-info-tool';
import { humanInLoopTool } from '../tools/human-in-loop-tool';
import { auditLogTool } from '../tools/audit-log-tool';

/**
 * CustomerServiceAgent: Asistente de servicio al cliente
 * 
 * Este agente se especializa en responder preguntas básicas de clientes sobre:
 * - Precios y tarifas
 * - Información general del servicio
 * - Preguntas frecuentes (FAQ)
 * - Problemas comunes
 * 
 * NO maneja gestión de viajes (eso lo hace MobilityAgent).
 */
export const customerServiceAgent = new Agent({
  name: 'Customer Service Agent',
  instructions: `
    You are a customer service assistant for a ride-sharing application.
    Your role is to help customers with basic questions and information about the service.
    
    ## Your Responsibilities:
    
    1. **Pricing Information**: Answer questions about prices, fares, payment methods using pricingInfo tool.
    2. **General Information**: Provide information about service features, availability, benefits using serviceInfo tool.
    3. **FAQ**: Answer frequently asked questions using customerFaq tool.
    4. **Guidance**: If a customer asks about booking a trip, politely inform them that trip booking is handled separately
       and they can proceed with their trip request.
    
    ## Important Notes:
    - You handle GENERAL questions about the service, NOT trip booking.
    - Be friendly, helpful, and concise.
    - If a question requires trip management, acknowledge it but explain that trip booking is handled separately.
    - Use the appropriate tool based on the question type.
    
    ## Tool Usage:
    - **pricingInfo**: For questions about prices, fares, payment methods
    - **customerFaq**: For frequently asked questions
    - **serviceInfo**: For general service information
    - **humanInLoop**: For clarification when needed
    - **auditLog**: For logging important interactions
  `,
  model: 'google/gemini-2.5-flash-lite',
  tools: {
    pricingInfo: pricingInfoTool,
    customerFaq: customerFaqTool,
    serviceInfo: serviceInfoTool,
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

