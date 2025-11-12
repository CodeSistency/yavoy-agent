import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * ServiceInfo_Tool: Información general sobre el servicio
 * 
 * Proporciona información general sobre el servicio, características,
 * beneficios, y cómo usar la aplicación.
 */
export const serviceInfoTool = createTool({
  id: 'service-info',
  description: `Proporciona información general sobre el servicio y la aplicación.
    Responde preguntas sobre características, beneficios, disponibilidad,
    y cualquier información general del servicio.`,
  inputSchema: z.object({
    topic: z.string().describe('Tema sobre el cual se solicita información'),
  }),
  outputSchema: z.object({
    information: z.string().describe('Información sobre el tema solicitado'),
    features: z.array(z.string()).optional().describe('Características relacionadas'),
  }),
  execute: async ({ context }) => {
    const { topic } = context;
    
    try {
      const topicLower = topic.toLowerCase();
      
      const serviceInfo: Record<string, { information: string; features?: string[] }> = {
        'características': {
          information: 'Nuestra aplicación ofrece múltiples características: reserva rápida y fácil, seguimiento en tiempo real, múltiples opciones de vehículos (Económico, Confort, Premium), programación de viajes, historial de viajes, y sistema de calificaciones. También ofrecemos opciones de compartir viaje y viajes programados.',
          features: [
            'Reserva rápida',
            'Seguimiento en tiempo real',
            'Múltiples tipos de vehículos',
            'Programación de viajes',
            'Historial de viajes',
            'Sistema de calificaciones',
          ],
        },
        'disponibilidad': {
          information: 'Nuestro servicio está disponible las 24 horas del día, los 7 días de la semana. Operamos en múltiples ciudades y estamos expandiéndonos constantemente. Puedes verificar la disponibilidad en tu área abriendo la aplicación.',
          features: ['Disponible 24/7', 'Múltiples ciudades', 'Expansión continua'],
        },
        'beneficios': {
          information: 'Al usar nuestro servicio obtienes: viajes seguros con conductores verificados, precios transparentes, múltiples opciones de pago, seguimiento en tiempo real, y soporte al cliente las 24 horas. También acumulas puntos de lealtad que puedes canjear por descuentos.',
          features: [
            'Conductores verificados',
            'Precios transparentes',
            'Múltiples métodos de pago',
            'Seguimiento en tiempo real',
            'Soporte 24/7',
            'Programa de lealtad',
          ],
        },
        'aplicación': {
          information: 'Nuestra aplicación está disponible para iOS y Android. Puedes descargarla desde la App Store o Google Play Store. La aplicación es fácil de usar: simplemente regístrate, agrega un método de pago, y comienza a reservar viajes.',
          features: ['iOS y Android', 'Fácil de usar', 'Registro simple'],
        },
      };
      
      let information = '';
      let features: string[] = [];
      
      for (const [keyword, data] of Object.entries(serviceInfo)) {
        if (topicLower.includes(keyword)) {
          information = data.information;
          features = data.features || [];
          break;
        }
      }
      
      if (!information) {
        information = 'Nuestro servicio de movilidad ofrece una forma conveniente y segura de viajar. ';
        information += 'Puedes reservar viajes fácilmente, elegir entre diferentes tipos de vehículos, ';
        information += 'y disfrutar de un servicio disponible las 24 horas. ';
        information += 'Si tienes preguntas específicas, estaré encantado de ayudarte.';
        features = ['Reserva fácil', 'Múltiples opciones', 'Disponible 24/7'];
      }
      
      return {
        information,
        features,
      };
    } catch (error) {
      throw new Error(`Error en información del servicio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

