import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * DriverFAQ_Tool: Base de conocimiento de preguntas frecuentes para conductores
 * 
 * Proporciona respuestas a preguntas frecuentes específicas de conductores
 * sobre el uso de la aplicación, problemas comunes, y asistencia.
 */
export const driverFaqTool = createTool({
  id: 'driver-faq',
  description: `Responde preguntas frecuentes específicas de conductores.
    Proporciona información sobre problemas comunes, uso de la aplicación,
    asistencia técnica, y otros temas relevantes para conductores.`,
  inputSchema: z.object({
    question: z.string().describe('Pregunta del conductor'),
  }),
  outputSchema: z.object({
    answer: z.string().describe('Respuesta a la pregunta'),
    category: z.string().describe('Categoría de la pregunta'),
  }),
  execute: async ({ context }) => {
    const { question } = context;
    
    try {
      const questionLower = question.toLowerCase();
      
      const driverFaq: Record<string, { answer: string; category: string }> = {
        'problema técnico': {
          answer: 'Si tienes problemas técnicos con la aplicación, puedes: 1) Cerrar y reiniciar la aplicación, 2) Verificar tu conexión a internet, 3) Actualizar la aplicación a la última versión, 4) Contactar a soporte técnico a través de la aplicación o por teléfono. Nuestro equipo de soporte está disponible las 24 horas para ayudarte.',
          category: 'technical',
        },
        'no recibo viajes': {
          answer: 'Si no estás recibiendo solicitudes de viajes, verifica: que estés en modo "En línea", que tu ubicación esté actualizada, que estés en un área con demanda, y que tu calificación esté por encima del mínimo requerido. También asegúrate de que tu aplicación esté actualizada y que no tengas restricciones en tu cuenta.',
          category: 'app_usage',
        },
        'calificación': {
          answer: 'Tu calificación se basa en las reseñas de los pasajeros. Para mantener una buena calificación: proporciona un servicio de calidad, mantén tu vehículo limpio, sé puntual, sigue las rutas sugeridas, y trata a los pasajeros con respeto. Una calificación baja puede limitar tu acceso a viajes.',
          category: 'performance',
        },
        'reportar pasajero': {
          answer: 'Si necesitas reportar un problema con un pasajero, puedes hacerlo a través de la aplicación después de completar el viaje. También puedes contactar a soporte inmediatamente si hay un problema de seguridad. Todos los reportes son revisados y se toman las acciones apropiadas.',
          category: 'safety',
        },
        'actualizar perfil': {
          answer: 'Puedes actualizar tu perfil en la sección "Configuración" de la aplicación. Puedes cambiar tu foto, información de contacto, método de pago, y preferencias. Algunos cambios pueden requerir verificación adicional.',
          category: 'account',
        },
      };
      
      let answer = '';
      let category = 'general';
      
      for (const [keyword, data] of Object.entries(driverFaq)) {
        if (questionLower.includes(keyword)) {
          answer = data.answer;
          category = data.category;
          break;
        }
      }
      
      if (!answer) {
        answer = 'Gracias por tu pregunta. Como conductor, tienes acceso a múltiples recursos de ayuda. ';
        answer += 'Puedes contactar a nuestro equipo de soporte las 24 horas a través de la aplicación, ';
        answer += 'revisar la sección de Ayuda para guías detalladas, o visitar nuestro centro de ayuda en línea. ';
        answer += 'Si tu pregunta es sobre un tema específico (pagos, políticas, problemas técnicos), puedo ayudarte con más detalles.';
        category = 'general';
      }
      
      return {
        answer,
        category,
      };
    } catch (error) {
      throw new Error(`Error en FAQ de conductor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

