import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * RouteToSubagent_Tool: Enruta solicitudes a subagentes apropiados
 * 
 * Esta herramienta permite al Orchestrator delegar tareas a subagentes específicos.
 * El orchestrator puede usar esta herramienta para determinar qué subagente debe manejar
 * una solicitud y luego llamar directamente al subagente.
 */
export const routeToSubagentTool = createTool({
  id: 'route-to-subagent',
  description: `Determina qué subagente debe manejar una solicitud del usuario.
    Analiza la intención del usuario y el tipo de usuario (cliente/conductor) para
    enrutar a mobility-agent, customer-service-agent, o driver-service-agent.`,
  inputSchema: z.object({
    userMessage: z.string().describe('Mensaje o solicitud del usuario'),
    userType: z.enum(['customer', 'driver', 'unknown']).optional().describe('Tipo de usuario si está disponible'),
    context: z.record(z.any()).optional().describe('Contexto adicional de la conversación'),
  }),
  outputSchema: z.object({
    recommendedAgent: z.enum(['mobility-agent', 'customer-service-agent', 'driver-service-agent']).describe('Subagente recomendado para manejar la solicitud'),
    confidence: z.number().min(0).max(1).describe('Nivel de confianza en la recomendación (0-1)'),
    reasoning: z.string().describe('Razón por la cual se recomienda este agente'),
    requiresMultipleAgents: z.boolean().optional().describe('Indica si la solicitud requiere múltiples agentes'),
  }),
  execute: async ({ context }) => {
    const { userMessage, userType, context: additionalContext } = context;
    
    try {
      // Análisis simple basado en palabras clave y contexto
      // En producción, esto podría usar un modelo de clasificación más sofisticado
      
      const message = userMessage.toLowerCase();
      
      // Palabras clave para Mobility Agent (gestión de viajes)
      const mobilityKeywords = [
        'viaje', 'viajar', 'ir a', 'llevar', 'recoger', 'destino', 'origen',
        'ruta', 'distancia', 'tiempo', 'precio del viaje', 'reservar',
        'cancelar viaje', 'ubicación', 'dirección', 'mapa', 'navegar',
        'conductor disponible', 'buscar conductor'
      ];
      
      // Palabras clave para Customer Service Agent (preguntas básicas de clientes)
      const customerServiceKeywords = [
        'cuánto cuesta', 'precio', 'tarifa', 'costo', 'cuánto vale',
        'método de pago', 'cómo pagar', 'cancelar', 'reembolso',
        'qué es', 'cómo funciona', 'información', 'ayuda',
        'problema', 'soporte', 'contacto', 'pregunta frecuente', 'faq'
      ];
      
      // Palabras clave para Driver Service Agent (preguntas de conductores)
      const driverServiceKeywords = [
        'comisión', 'ganancia', 'pago', 'cobro', 'dinero',
        'requisitos', 'documentos', 'registro', 'verificación',
        'política', 'reglas', 'normas', 'prohibido', 'permitido',
        'reportar', 'problema con pasajero', 'calificación'
      ];
      
      // Contar coincidencias
      const mobilityScore = mobilityKeywords.filter(keyword => message.includes(keyword)).length;
      const customerServiceScore = customerServiceKeywords.filter(keyword => message.includes(keyword)).length;
      const driverServiceScore = driverServiceKeywords.filter(keyword => message.includes(keyword)).length;
      
      // Considerar el tipo de usuario si está disponible
      let recommendedAgent: 'mobility-agent' | 'customer-service-agent' | 'driver-service-agent';
      let confidence = 0.5;
      let reasoning = '';
      
      // Si el usuario es conductor y pregunta sobre su trabajo, priorizar driver-service
      if (userType === 'driver' && driverServiceScore > 0) {
        recommendedAgent = 'driver-service-agent';
        confidence = 0.8;
        reasoning = 'Usuario identificado como conductor con pregunta relacionada a su trabajo';
      }
      // Si hay indicadores claros de gestión de viaje, usar mobility-agent
      else if (mobilityScore > 0 && mobilityScore >= customerServiceScore && mobilityScore >= driverServiceScore) {
        recommendedAgent = 'mobility-agent';
        confidence = Math.min(0.9, 0.5 + (mobilityScore * 0.1));
        reasoning = `Mensaje contiene ${mobilityScore} indicadores de gestión de viaje`;
      }
      // Si hay indicadores de preguntas básicas y es cliente, usar customer-service
      else if (userType === 'customer' && customerServiceScore > 0 && customerServiceScore >= driverServiceScore) {
        recommendedAgent = 'customer-service-agent';
        confidence = Math.min(0.9, 0.5 + (customerServiceScore * 0.1));
        reasoning = `Cliente con ${customerServiceScore} indicadores de pregunta básica o soporte`;
      }
      // Si hay indicadores de preguntas de conductor
      else if (driverServiceScore > 0 && driverServiceScore >= customerServiceScore) {
        recommendedAgent = 'driver-service-agent';
        confidence = Math.min(0.9, 0.5 + (driverServiceScore * 0.1));
        reasoning = `Mensaje contiene ${driverServiceScore} indicadores de pregunta de conductor`;
      }
      // Si hay indicadores de preguntas básicas (sin tipo de usuario claro)
      else if (customerServiceScore > 0) {
        recommendedAgent = 'customer-service-agent';
        confidence = Math.min(0.8, 0.4 + (customerServiceScore * 0.1));
        reasoning = `Mensaje contiene ${customerServiceScore} indicadores de pregunta básica o soporte`;
      }
      // Default: usar mobility-agent para gestión de viajes
      else {
        recommendedAgent = 'mobility-agent';
        confidence = 0.6;
        reasoning = 'No se identificaron indicadores específicos, usando mobility-agent como default';
      }
      
      // Detectar si requiere múltiples agentes (ej: "quiero un viaje, ¿cuánto cuesta?")
      const requiresMultipleAgents = 
        (mobilityScore > 0 && customerServiceScore > 0) ||
        (mobilityScore > 0 && driverServiceScore > 0);
      
      return {
        recommendedAgent,
        confidence,
        reasoning,
        requiresMultipleAgents,
      };
    } catch (error) {
      // Fallback seguro
      return {
        recommendedAgent: 'mobility-agent' as const,
        confidence: 0.5,
        reasoning: `Error en análisis: ${error instanceof Error ? error.message : 'Unknown error'}. Usando mobility-agent como fallback.`,
        requiresMultipleAgents: false,
      };
    }
  },
});

