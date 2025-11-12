import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * DriverInfo_Tool: Información específica para conductores
 * 
 * Proporciona información sobre cómo usar la aplicación como conductor,
 * requisitos, proceso de registro, y funcionalidades disponibles.
 */
export const driverInfoTool = createTool({
  id: 'driver-info',
  description: `Proporciona información específica para conductores sobre cómo usar la aplicación,
    requisitos para ser conductor, proceso de registro, y funcionalidades disponibles para conductores.`,
  inputSchema: z.object({
    question: z.string().describe('Pregunta del conductor'),
    topic: z.enum(['registration', 'requirements', 'app_usage', 'features', 'other']).optional().describe('Tema específico si está disponible'),
  }),
  outputSchema: z.object({
    answer: z.string().describe('Respuesta a la pregunta del conductor'),
    topic: z.string().describe('Tema de la respuesta'),
    relatedInfo: z.array(z.string()).optional().describe('Información relacionada'),
  }),
  execute: async ({ context }) => {
    const { question, topic } = context;
    
    try {
      const questionLower = question.toLowerCase();
      
      const driverInfo: Record<string, { answer: string; topic: string; relatedInfo?: string[] }> = {
        'registro': {
          answer: 'Para registrarte como conductor, necesitas: 1) Descargar la aplicación de conductor, 2) Completar el formulario de registro con tus datos personales, 3) Subir documentos requeridos (licencia de conducir, registro del vehículo, seguro), 4) Completar la verificación de identidad, 5) Aprobar el proceso de verificación de antecedentes. Una vez aprobado, podrás comenzar a recibir solicitudes de viajes.',
          topic: 'registration',
          relatedInfo: ['requisitos', 'documentos', 'verificación'],
        },
        'requisitos': {
          answer: 'Los requisitos para ser conductor incluyen: tener al menos 21 años de edad, poseer una licencia de conducir válida con al menos 1 año de experiencia, tener un vehículo en buen estado (modelo 2010 o más reciente), seguro de vehículo válido, pasar verificación de antecedentes, y completar el proceso de verificación de identidad. Algunos mercados pueden tener requisitos adicionales.',
          topic: 'requirements',
          relatedInfo: ['registro', 'documentos', 'vehículo'],
        },
        'documentos': {
          answer: 'Necesitas los siguientes documentos: licencia de conducir válida, registro del vehículo, seguro del vehículo, comprobante de identidad (pasaporte o cédula), y en algunos casos, certificado de antecedentes penales. Todos los documentos deben estar vigentes y en buen estado.',
          topic: 'requirements',
          relatedInfo: ['requisitos', 'registro'],
        },
        'aplicación': {
          answer: 'La aplicación de conductor te permite: recibir solicitudes de viajes, ver detalles del pasajero y destino, navegar a la ubicación del pasajero, iniciar y finalizar viajes, recibir pagos automáticamente, ver tus ganancias y estadísticas, y comunicarte con pasajeros. La app es fácil de usar y está disponible para iOS y Android.',
          topic: 'app_usage',
          relatedInfo: ['funcionalidades', 'viajes', 'pagos'],
        },
        'funcionalidades': {
          answer: 'Como conductor, puedes: aceptar o rechazar solicitudes de viajes, ver el historial de tus viajes, acceder a tus ganancias y pagos, ver tus calificaciones y comentarios, programar tus horas de trabajo, ver estadísticas de desempeño, y reportar problemas o incidentes.',
          topic: 'features',
          relatedInfo: ['aplicación', 'viajes', 'pagos'],
        },
      };
      
      let answer = '';
      let answerTopic = topic || 'other';
      let relatedInfo: string[] = [];
      
      for (const [keyword, data] of Object.entries(driverInfo)) {
        if (questionLower.includes(keyword)) {
          answer = data.answer;
          answerTopic = data.topic;
          relatedInfo = data.relatedInfo || [];
          break;
        }
      }
      
      if (!answer) {
        answer = 'Como conductor, tienes acceso a múltiples funcionalidades en la aplicación. ';
        answer += 'Puedes recibir solicitudes de viajes, gestionar tus viajes, ver tus ganancias, ';
        answer += 'y acceder a estadísticas de desempeño. Si tienes una pregunta específica, ';
        answer += 'puedo ayudarte con información sobre registro, requisitos, pagos, o políticas.';
        answerTopic = 'other';
        relatedInfo = ['registro', 'pagos', 'políticas'];
      }
      
      return {
        answer,
        topic: answerTopic,
        relatedInfo,
      };
    } catch (error) {
      throw new Error(`Error en información de conductor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

