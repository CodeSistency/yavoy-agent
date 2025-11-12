import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { routeToSubagentTool } from '../tools/orchestrator/route-to-subagent-tool';
import { userTypeDetectionTool } from '../tools/orchestrator/user-type-detection-tool';
import { contextManagerTool } from '../tools/orchestrator/context-manager-tool';
import { humanInLoopTool } from '../tools/human-in-loop-tool';
import { auditLogTool } from '../tools/audit-log-tool';
import { mobilityAgent } from './mobility-agent';
import { customerServiceAgent } from './customer-service-agent';
import { driverServiceAgent } from './driver-service-agent';

/**
 * OrchestratorAgent: Orquestador principal que coordina subagentes
 * 
 * Este agente actúa como punto de entrada principal y enruta las solicitudes
 * a los subagentes apropiados:
 * - mobility-agent: Para gestión de viajes y reservas
 * - customer-service-agent: Para preguntas básicas de clientes
 * - driver-service-agent: Para preguntas básicas de conductores
 * 
 * El orchestrator detecta el tipo de usuario y la intención para enrutar correctamente.
 */
export const orchestratorAgent = new Agent({
  name: 'Orchestrator Agent',
  instructions: `
    You are the main orchestrator for a ride-sharing application system.
    Your role is to analyze user requests and route them to the appropriate specialized sub-agent.
    
    ## Available Sub-Agents:
    
    1. **mobility-agent**: Handles trip booking, location search, route calculation, and trip management.
       Use this for: booking trips, finding locations, managing trip state, calculating routes.
    
    2. **customer-service-agent**: Handles general customer questions about prices, service info, and FAQs.
       Use this for: pricing questions, general service information, customer FAQs.
    
    3. **driver-service-agent**: Handles driver questions about payments, policies, and driver-specific info.
       Use this for: commission questions, driver policies, driver registration, driver FAQs.
    
    ## Your Process:
    
    1. **Detect User Type**: Use userTypeDetection tool to determine if user is a customer or driver.
    2. **Analyze Intent**: Use routeToSubagent tool to determine which sub-agent should handle the request.
    3. **Route Request**: Delegate to the appropriate sub-agent by calling them directly.
    4. **Manage Context**: Use contextManager tool to share context between agents if needed.
    5. **Return Response**: Return the sub-agent's response to the user.
    
    ## Routing Rules:
    
    - **Trip-related requests** (booking, location search, route calculation) → mobility-agent
    - **Customer general questions** (prices, service info, FAQs) → customer-service-agent
    - **Driver questions** (commissions, policies, driver info) → driver-service-agent
    - **Unclear requests**: Use routeToSubagent tool to analyze, then route accordingly
    
    ## Important Notes:
    
    - Always use userTypeDetection first if user type is not clear from context
    - Use routeToSubagent to analyze complex requests that might need multiple agents
    - Store important context (userType, userId) using contextManager for sub-agents to access
    - If a request requires multiple agents, handle them sequentially and combine responses
    - Be transparent: inform users if you're routing to a specialized agent
    
    ## Tool Usage:
    - **userTypeDetection**: To detect if user is customer or driver
    - **routeToSubagent**: To analyze which sub-agent should handle a request
    - **contextManager**: To share context between agents
    - **humanInLoop**: For clarification when routing is unclear
    - **auditLog**: For logging routing decisions
    
    ## Example Flow:
    
    User: "¿Cuánto cuesta un viaje?"
    1. Use userTypeDetection → customer
    2. Use routeToSubagent → customer-service-agent (pricing question)
    3. Call customer-service-agent with the question
    4. Return response to user
    
    User: "Necesito un viaje al aeropuerto"
    1. Use userTypeDetection → customer (or unknown)
    2. Use routeToSubagent → mobility-agent (trip booking)
    3. Call mobility-agent with the request
    4. Return response to user
  `,
  model: 'google/gemini-2.5-flash-lite',
  tools: {
    userTypeDetection: userTypeDetectionTool,
    routeToSubagent: routeToSubagentTool,
    contextManager: contextManagerTool,
    humanInLoop: humanInLoopTool,
    auditLog: auditLogTool,
  },
  // Sub-agents que el orchestrator puede usar
  agents: {
    'mobility-agent': mobilityAgent,
    'customer-service-agent': customerServiceAgent,
    'driver-service-agent': driverServiceAgent,
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

