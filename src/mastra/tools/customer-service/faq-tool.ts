import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * FAQ_Tool: Base de conocimiento de preguntas frecuentes para clientes
 * 
 * Esta herramienta proporciona respuestas a preguntas frecuentes de clientes
 * sobre el servicio, uso de la aplicación, políticas, etc.
 */
export const customerFaqTool = createTool({
  id: 'customer-faq',
  description: `Responde preguntas frecuentes de clientes sobre el servicio.
    Proporciona información sobre cómo usar la aplicación, políticas de cancelación,
    reembolsos, seguridad, y otros temas comunes.`,
  inputSchema: z.object({
    question: z.string().describe('Pregunta del cliente'),
    category: z.enum(['general', 'booking', 'payment', 'cancellation', 'safety', 'other']).optional().describe('Categoría de la pregunta si está disponible'),
  }),
  outputSchema: z.object({
    answer: z.string().describe('Respuesta a la pregunta'),
    category: z.string().describe('Categoría de la pregunta'),
    relatedTopics: z.array(z.string()).optional().describe('Temas relacionados que podrían ser útiles'),
  }),
  execute: async ({ context }) => {
    const { question, category } = context;
    
    try {
      const questionLower = question.toLowerCase();
      
      // Base de conocimiento de FAQ
      const faqDatabase: Record<string, { answer: string; category: string; relatedTopics?: string[] }> = {
        // Cancelación
        'cancelar': {
          answer: 'Puedes cancelar tu viaje en cualquier momento antes de que el conductor llegue. Si cancelas después de que el conductor haya iniciado el viaje, pueden aplicarse tarifas de cancelación según nuestras políticas. Las cancelaciones gratuitas están disponibles dentro de los primeros minutos después de la confirmación.',
          category: 'cancellation',
          relatedTopics: ['reembolso', 'política de cancelación'],
        },
        'reembolso': {
          answer: 'Los reembolsos se procesan automáticamente si cancelas dentro del período de cancelación gratuita. Si se aplica una tarifa de cancelación, el reembolso será por el monto restante. Los reembolsos pueden tardar de 3 a 5 días hábiles en aparecer en tu cuenta, dependiendo de tu método de pago.',
          category: 'cancellation',
          relatedTopics: ['cancelar', 'política de cancelación'],
        },
        
        // Seguridad
        'seguro': {
          answer: 'Tu seguridad es nuestra prioridad. Todos los conductores son verificados y tienen licencias válidas. Compartimos información del viaje con contactos de emergencia si lo configuras. Puedes reportar cualquier problema a través de la aplicación y nuestro equipo lo revisará inmediatamente.',
          category: 'safety',
          relatedTopics: ['reportar problema', 'verificación de conductores'],
        },
        'reportar': {
          answer: 'Puedes reportar problemas o incidentes a través de la aplicación en la sección "Ayuda" o "Reportar problema". También puedes contactar a nuestro equipo de soporte las 24 horas. Todos los reportes son revisados y tomamos medidas apropiadas.',
          category: 'safety',
          relatedTopics: ['seguridad', 'soporte'],
        },
        
        // Reserva
        'reservar': {
          answer: 'Para reservar un viaje, simplemente abre la aplicación, ingresa tu destino, selecciona el tipo de vehículo que prefieres, y confirma. El sistema te mostrará el precio estimado y el tiempo de llegada del conductor. Puedes programar viajes con anticipación también.',
          category: 'booking',
          relatedTopics: ['precio', 'tiempo de llegada'],
        },
        'programar': {
          answer: 'Sí, puedes programar viajes con anticipación. Selecciona la opción "Programar viaje" al hacer tu reserva y elige la fecha y hora deseada. El conductor será asignado cerca de la hora programada.',
          category: 'booking',
          relatedTopics: ['reservar', 'viaje programado'],
        },
        
        // General
        'cómo funciona': {
          answer: 'Nuestra aplicación conecta pasajeros con conductores verificados. Simplemente abre la app, ingresa tu destino, y un conductor cercano te recogerá. El pago se procesa automáticamente al finalizar el viaje. Es rápido, seguro y conveniente.',
          category: 'general',
          relatedTopics: ['reservar', 'pago', 'seguridad'],
        },
        'contacto': {
          answer: 'Puedes contactarnos a través de la aplicación en la sección "Ayuda" o "Soporte", por correo electrónico a soporte@yavoy.com, o llamando a nuestra línea de atención al cliente las 24 horas. Estamos aquí para ayudarte.',
          category: 'general',
          relatedTopics: ['soporte', 'ayuda'],
        },
      };
      
      // Buscar respuesta en la base de conocimiento
      let answer = '';
      let answerCategory = category || 'general';
      let relatedTopics: string[] = [];
      
      for (const [keyword, data] of Object.entries(faqDatabase)) {
        if (questionLower.includes(keyword)) {
          answer = data.answer;
          answerCategory = data.category;
          relatedTopics = data.relatedTopics || [];
          break;
        }
      }
      
      // Si no se encontró respuesta específica, proporcionar respuesta genérica
      if (!answer) {
        answer = 'Gracias por tu pregunta. Para obtener la mejor asistencia, puedes: ';
        answer += '1) Revisar nuestra sección de Ayuda en la aplicación, ';
        answer += '2) Contactar a nuestro equipo de soporte a través de la app, ';
        answer += '3) Visitar nuestro sitio web para más información. ';
        answer += 'Si tu pregunta es sobre un viaje específico, puedo ayudarte con eso también.';
        answerCategory = 'general';
        relatedTopics = ['soporte', 'ayuda', 'contacto'];
      }
      
      return {
        answer,
        category: answerCategory,
        relatedTopics,
      };
    } catch (error) {
      throw new Error(`Error en FAQ: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

