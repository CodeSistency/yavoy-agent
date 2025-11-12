import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * PaymentInfo_Tool: Información sobre pagos y comisiones para conductores
 * 
 * Proporciona información sobre cómo funcionan los pagos, comisiones,
 * estructura de ganancias, y métodos de pago para conductores.
 */
export const paymentInfoTool = createTool({
  id: 'payment-info',
  description: `Proporciona información sobre pagos, comisiones y ganancias para conductores.
    Responde preguntas sobre cómo se calculan las comisiones, cuándo se reciben los pagos,
    métodos de pago disponibles, y estructura de ganancias.`,
  inputSchema: z.object({
    question: z.string().describe('Pregunta del conductor sobre pagos o comisiones'),
  }),
  outputSchema: z.object({
    answer: z.string().describe('Respuesta sobre pagos y comisiones'),
    commissionStructure: z.object({
      platformCommission: z.number().describe('Comisión de la plataforma (porcentaje)'),
      driverEarnings: z.number().describe('Ganancia del conductor (porcentaje)'),
    }).optional().describe('Estructura de comisiones'),
    paymentSchedule: z.string().optional().describe('Información sobre frecuencia de pagos'),
    paymentMethods: z.array(z.string()).optional().describe('Métodos de pago disponibles'),
  }),
  execute: async ({ context }) => {
    const { question } = context;
    
    try {
      const questionLower = question.toLowerCase();
      
      const commissionStructure = {
        platformCommission: 25, // 25% para la plataforma
        driverEarnings: 75, // 75% para el conductor
      };
      
      const paymentMethods = [
        'Transferencia bancaria',
        'PayPal',
        'Billetera digital',
        'Efectivo (en algunos mercados)',
      ];
      
      let answer = '';
      let paymentSchedule = 'Los pagos se procesan semanalmente cada lunes para todos los viajes completados la semana anterior. Los fondos pueden tardar de 2 a 5 días hábiles en aparecer en tu cuenta, dependiendo de tu método de pago.';
      
      if (questionLower.includes('comisión') || questionLower.includes('ganancia') || questionLower.includes('cuánto')) {
        answer = `La estructura de comisiones es la siguiente: `;
        answer += `La plataforma retiene el ${commissionStructure.platformCommission}% de cada viaje, `;
        answer += `y tú recibes el ${commissionStructure.driverEarnings}% restante. `;
        answer += `Por ejemplo, si un viaje cuesta $10, recibirías $7.50. `;
        answer += `Las comisiones se deducen automáticamente y puedes ver el desglose en cada viaje.`;
      } else if (questionLower.includes('pago') || questionLower.includes('cobro') || questionLower.includes('dinero')) {
        answer = `Los pagos se procesan automáticamente. `;
        answer += `Recibirás el ${commissionStructure.driverEarnings}% de cada viaje completado. `;
        answer += paymentSchedule;
        answer += ` Los métodos de pago disponibles son: ${paymentMethods.join(', ')}. `;
        answer += `Puedes configurar tu método de pago preferido en la sección de configuración de la aplicación.`;
      } else if (questionLower.includes('cuándo') || questionLower.includes('frecuencia')) {
        answer = paymentSchedule;
        answer += ` Puedes ver tus ganancias pendientes y pagadas en la sección de "Ganancias" de la aplicación.`;
      } else {
        answer = `Sobre pagos y comisiones: `;
        answer += `Recibes el ${commissionStructure.driverEarnings}% de cada viaje completado. `;
        answer += `Los pagos se procesan semanalmente y puedes ver el desglose completo `;
        answer += `de tus ganancias en la aplicación. `;
        answer += `Si tienes preguntas específicas sobre un pago, puedes contactar a soporte.`;
      }
      
      return {
        answer,
        commissionStructure,
        paymentSchedule,
        paymentMethods,
      };
    } catch (error) {
      throw new Error(`Error en información de pagos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

