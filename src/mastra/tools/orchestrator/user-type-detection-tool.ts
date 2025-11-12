import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * UserTypeDetection_Tool: Detecta el tipo de usuario (cliente o conductor)
 * 
 * Esta herramienta analiza el contexto y mensajes del usuario para determinar
 * si es un cliente o un conductor. Puede usar información explícita (si está disponible)
 * o inferir del contexto de la conversación.
 */
export const userTypeDetectionTool = createTool({
  id: 'user-type-detection',
  description: `Detecta si el usuario es un cliente o un conductor.
    Puede usar información explícita del contexto o inferir del contenido del mensaje.
    Útil para enrutar correctamente las solicitudes a los subagentes apropiados.`,
  inputSchema: z.object({
    userMessage: z.string().optional().describe('Mensaje actual del usuario'),
    explicitUserType: z.enum(['customer', 'driver']).optional().describe('Tipo de usuario explícito si está disponible en el contexto'),
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional().describe('Historial de conversación para contexto'),
  }),
  outputSchema: z.object({
    userType: z.enum(['customer', 'driver', 'unknown']).describe('Tipo de usuario detectado'),
    confidence: z.number().min(0).max(1).describe('Nivel de confianza en la detección (0-1)'),
    reasoning: z.string().describe('Razón por la cual se detectó este tipo de usuario'),
    indicators: z.array(z.string()).optional().describe('Indicadores encontrados que sugieren el tipo de usuario'),
  }),
  execute: async ({ context }) => {
    const { userMessage, explicitUserType, conversationHistory } = context;
    
    try {
      // Si hay tipo explícito, usarlo con alta confianza
      if (explicitUserType) {
        return {
          userType: explicitUserType,
          confidence: 0.95,
          reasoning: `Tipo de usuario explícito proporcionado: ${explicitUserType}`,
          indicators: ['explicit_type'],
        };
      }
      
      // Analizar mensaje y historial para inferir tipo
      const allText = [
        userMessage || '',
        ...(conversationHistory || []).map(msg => msg.content),
      ].join(' ').toLowerCase();
      
      // Indicadores de conductor
      const driverIndicators = [
        'soy conductor', 'conduzco', 'mi vehículo', 'mi auto', 'mi carro',
        'mis viajes', 'mis pasajeros', 'mi comisión', 'mis ganancias',
        'mi perfil de conductor', 'mi cuenta de conductor',
        'quiero ser conductor', 'registrarme como conductor',
        'documentos de conductor', 'verificación de conductor',
        'reportar pasajero', 'problema con pasajero'
      ];
      
      // Indicadores de cliente
      const customerIndicators = [
        'quiero un viaje', 'necesito un viaje', 'reservar viaje',
        'buscar conductor', 'conductor disponible',
        'mi viaje', 'mi reserva', 'mi pedido',
        'calificar conductor', 'problema con conductor',
        'cancelar mi viaje', 'mi pago'
      ];
      
      const driverMatches = driverIndicators.filter(indicator => allText.includes(indicator));
      const customerMatches = customerIndicators.filter(indicator => allText.includes(indicator));
      
      let userType: 'customer' | 'driver' | 'unknown';
      let confidence = 0.5;
      let reasoning = '';
      
      if (driverMatches.length > 0 && driverMatches.length >= customerMatches.length) {
        userType = 'driver';
        confidence = Math.min(0.9, 0.5 + (driverMatches.length * 0.1));
        reasoning = `Encontrados ${driverMatches.length} indicadores de conductor`;
      } else if (customerMatches.length > 0) {
        userType = 'customer';
        confidence = Math.min(0.9, 0.5 + (customerMatches.length * 0.1));
        reasoning = `Encontrados ${customerMatches.length} indicadores de cliente`;
      } else {
        userType = 'unknown';
        confidence = 0.3;
        reasoning = 'No se encontraron indicadores claros del tipo de usuario';
      }
      
      return {
        userType,
        confidence,
        reasoning,
        indicators: [...driverMatches, ...customerMatches],
      };
    } catch (error) {
      return {
        userType: 'unknown' as const,
        confidence: 0.0,
        reasoning: `Error en detección: ${error instanceof Error ? error.message : 'Unknown error'}`,
        indicators: [],
      };
    }
  },
});

