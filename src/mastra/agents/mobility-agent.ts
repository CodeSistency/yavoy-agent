import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';
import { googleMapsGroundingTool } from '../tools/google-maps-grounding-tool';
import { microAdjustTool } from '../tools/micro-adjust-tool';
import { tripStateTool } from '../tools/trip-state-tool';
import { preferenceTool } from '../tools/preference-tool';
import { routeCalculatorTool } from '../tools/route-calculator-tool';
import { humanInLoopTool } from '../tools/human-in-loop-tool';
import { auditLogTool } from '../tools/audit-log-tool';

/**
 * MobilityAgent: Agente conversacional para aplicación tipo Uber
 * 
 * Este agente maneja interacciones completamente impulsadas por IA para:
 * - Búsqueda y ajuste de ubicaciones usando Google Maps Grounding nativo de Gemini
 * - Gestión de estado de viaje (origen, destino, waypoints)
 * - Cálculo de rutas y precios usando Google Maps Directions API
 * - Gestión de preferencias de usuario
 * - Desambiguación cuando sea necesario
 * 
 * Integrado con Gemini Live para speech-to-speech en tiempo real.
 * Usa Google Maps Grounding para búsqueda precisa de lugares.
 */
// Configuración de voz condicional
const voiceConfig = process.env.ENABLE_VOICE === 'true' 
  ? {
      voice: new GeminiLiveVoice({
        apiKey: process.env.GOOGLE_API_KEY,
        model: 'gemini-2.0-flash-exp',
        speaker: 'Puck', // Puedes cambiar a otro speaker disponible
        debug: process.env.NODE_ENV === 'development',
      }),
    }
  : {};

export const mobilityAgent = new Agent({
  name: 'Mobility Agent',
  instructions: `
    You are a specialized mobility assistant focused exclusively on trip management and ride booking.
    Your role is to help users book rides by managing trip state, finding locations, and calculating routes.
    
    ## Your Responsibilities:
    
    1. **Location Search**: Use googleMapsGrounding to find locations. Always provide user's current location if available.
    2. **Trip Management**: Use tripState to manage origin, destination, and waypoints. Always confirm before calculating routes.
    3. **Route Calculation**: Use routeCalculator only when both origin and destination are set. Include user preferences.
    4. **Location Adjustments**: Use microAdjust for relative movements ("10 metros a la derecha").
    5. **User Preferences**: Use preference tool to retrieve saved locations and apply preferences.
    6. **Disambiguation**: Use humanInLoop when multiple location candidates are found.
    
    ## Important Notes:
    - You ONLY handle trip booking and management. For general questions about prices, policies, or service info, 
      direct users to ask those questions separately (they will be handled by other specialized agents).
    - Focus on: booking trips, managing trip state, finding locations, calculating routes.
    - Be conversational, confirm understanding, and provide clear information about trips.
    
    ## Tool Usage:
    - **googleMapsGrounding**: For all location searches
    - **tripState**: To manage trip state (origin, destination, waypoints)
    - **routeCalculator**: Only when origin AND destination are set
    - **microAdjust**: For relative location adjustments
    - **preference**: To get saved locations and preferences
    - **humanInLoop**: For disambiguation
    - **auditLog**: For important events
  `,
  model: 'google/gemini-2.5-flash-lite',
  tools: {
    googleMapsGrounding: googleMapsGroundingTool,
    microAdjust: microAdjustTool,
    tripState: tripStateTool,
    preference: preferenceTool,
    routeCalculator: routeCalculatorTool,
    humanInLoop: humanInLoopTool,
    auditLog: auditLogTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
    // Vector store para semantic recall
    vector: new LibSQLVector({
      connectionUrl: 'file:../mastra.db', // Mismo archivo que storage
    }),
    // Embedder para generar embeddings (usando Google ya que usamos Gemini)
    embedder: 'google/text-embedding-004', // o 'google/gemini-embedding-001'
    options: {
      lastMessages: 10, // Mantener contexto de últimas 10 mensajes
      semanticRecall: {
        topK: 5, // Recuperar los 5 mensajes más similares
        messageRange: 2, // Incluir 2 mensajes antes y después de cada coincidencia
        scope: 'resource', // Buscar en todos los threads del mismo usuario
      },
    },
  }),
  // Configuración de Gemini Live para speech-to-speech
  // Solo se configura si ENABLE_VOICE=true está definido en .env
  // Para usar voz: 1) Configura ENABLE_VOICE=true, 2) Llama a agent.voice.connect() antes de usar
  ...voiceConfig,
});

