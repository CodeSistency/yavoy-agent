import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * HumanInLoop_Tool: Desambiguación y confirmación con el usuario
 * 
 * Detiene el flujo cuando hay incertidumbre y genera mensajes estructurados
 * para obtener aclaración del usuario. Implementa el patrón Human-in-the-Loop.
 */
export const humanInLoopTool = createTool({
  id: 'human-in-loop',
  description: `Solicita aclaración o confirmación del usuario cuando hay incertidumbre.
    Útil para desambiguar ubicaciones, confirmar acciones críticas, o aclarar intenciones.
    Esta herramienta debe usarse cuando el agente no está 100% seguro de la intención del usuario.`,
  inputSchema: z.object({
    type: z.enum([
      'location_disambiguation',
      'confirmation',
      'clarification',
    ]).describe('Tipo de interacción con el usuario'),
    question: z.string().describe('Pregunta o mensaje para el usuario'),
    options: z.array(z.object({
      id: z.string().describe('Identificador único de la opción'),
      label: z.string().describe('Etiqueta visible de la opción'),
      description: z.string().optional().describe('Descripción adicional de la opción'),
    })).optional().describe('Opciones para que el usuario seleccione (para desambiguación)'),
    context: z.string().optional().describe('Contexto adicional para ayudar al usuario a decidir'),
  }),
  outputSchema: z.object({
    userResponse: z.string().describe('Respuesta del usuario'),
    selectedOptionId: z.string().optional().describe('ID de la opción seleccionada (si aplica)'),
    confirmed: z.boolean().describe('Indica si el usuario confirmó la acción'),
    message: z.string().describe('Mensaje formateado para mostrar al usuario'),
  }),
  execute: async ({ context }) => {
    const { type, question, options, context: additionalContext } = context;
    
    try {
      // Esta herramienta genera el mensaje estructurado para el usuario
      // En una implementación real, esto se integraría con el sistema de UI/voice
      // Por ahora, retornamos el mensaje formateado
      
      let message = question;
      
      if (options && options.length > 0) {
        message += '\n\nOpciones disponibles:\n';
        options.forEach((option, index) => {
          message += `${index + 1}. ${option.label}`;
          if (option.description) {
            message += ` - ${option.description}`;
          }
          message += '\n';
        });
      }
      
      if (additionalContext) {
        message += `\nContexto: ${additionalContext}`;
      }
      
      // En una implementación real, aquí se esperaría la respuesta del usuario
      // Por ahora, retornamos un placeholder que indica que se necesita interacción
      // El agente debe manejar esto y esperar la siguiente entrada del usuario
      
      return {
        userResponse: '[PENDING_USER_INPUT]', // Placeholder - se reemplazará con respuesta real
        selectedOptionId: undefined,
        confirmed: false,
        message,
      };
    } catch (error) {
      throw new Error(`Error en interacción con usuario: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

