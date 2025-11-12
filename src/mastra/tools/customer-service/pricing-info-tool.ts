import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * PricingInfo_Tool: Proporciona información sobre precios y tarifas
 * 
 * Esta herramienta proporciona información general sobre precios, tarifas,
 * y estructura de costos del servicio. Puede usar routeCalculatorTool internamente
 * si se necesita calcular un precio específico.
 */
export const pricingInfoTool = createTool({
  id: 'pricing-info',
  description: `Proporciona información sobre precios, tarifas y estructura de costos.
    Responde preguntas generales sobre cuánto cuestan los viajes, métodos de pago,
    y desglose de tarifas.`,
  inputSchema: z.object({
    question: z.string().describe('Pregunta del usuario sobre precios'),
    vehicleType: z.enum(['economy', 'comfort', 'premium']).optional().describe('Tipo de vehículo si está especificado'),
  }),
  outputSchema: z.object({
    answer: z.string().describe('Respuesta sobre precios y tarifas'),
    pricingStructure: z.object({
      baseFare: z.object({
        economy: z.number(),
        comfort: z.number(),
        premium: z.number(),
      }),
      perKmRate: z.object({
        economy: z.number(),
        comfort: z.number(),
        premium: z.number(),
      }),
      perMinuteRate: z.object({
        economy: z.number(),
        comfort: z.number(),
        premium: z.number(),
      }),
      currency: z.string(),
    }).describe('Estructura de precios'),
    paymentMethods: z.array(z.string()).describe('Métodos de pago aceptados'),
  }),
  execute: async ({ context }) => {
    const { question, vehicleType } = context;
    
    try {
      // Estructura de precios (en USD, ajustar según mercado)
      const pricingStructure = {
        baseFare: {
          economy: 2.5,
          comfort: 4.0,
          premium: 6.0,
        },
        perKmRate: {
          economy: 1.2,
          comfort: 1.8,
          premium: 2.5,
        },
        perMinuteRate: {
          economy: 0.25,
          comfort: 0.35,
          premium: 0.50,
        },
        currency: 'USD',
      };
      
      const paymentMethods = [
        'Tarjeta de crédito',
        'Tarjeta de débito',
        'PayPal',
        'Efectivo (en algunos mercados)',
        'Billeteras digitales',
      ];
      
      // Generar respuesta basada en la pregunta
      let answer = '';
      const questionLower = question.toLowerCase();
      
      if (questionLower.includes('cuánto') || questionLower.includes('precio') || questionLower.includes('costo')) {
        const type = vehicleType || 'economy';
        answer = `Los precios varían según el tipo de vehículo y la distancia del viaje. `;
        answer += `Para ${type === 'economy' ? 'Económico' : type === 'comfort' ? 'Confort' : 'Premium'}, `;
        answer += `la tarifa base es $${pricingStructure.baseFare[type]}, `;
        answer += `más $${pricingStructure.perKmRate[type]} por kilómetro y `;
        answer += `$${pricingStructure.perMinuteRate[type]} por minuto. `;
        answer += `El precio final se calcula en tiempo real según la ruta y el tráfico.`;
      } else if (questionLower.includes('pago') || questionLower.includes('método')) {
        answer = `Aceptamos los siguientes métodos de pago: ${paymentMethods.join(', ')}. `;
        answer += `El pago se procesa automáticamente al finalizar el viaje.`;
      } else if (questionLower.includes('tarifa') || questionLower.includes('estructura')) {
        answer = `Nuestra estructura de tarifas incluye: `;
        answer += `1) Tarifa base (varía según tipo de vehículo), `;
        answer += `2) Tarifa por distancia, `;
        answer += `3) Tarifa por tiempo. `;
        answer += `También puede haber tarifas dinámicas (surge pricing) durante períodos de alta demanda.`;
      } else {
        answer = `Los precios se calculan dinámicamente basándose en la distancia, tiempo, `;
        answer += `tipo de vehículo seleccionado, y condiciones de tráfico. `;
        answer += `Puedes ver el precio estimado antes de confirmar tu viaje. `;
        answer += `Aceptamos múltiples métodos de pago y el pago se procesa automáticamente.`;
      }
      
      return {
        answer,
        pricingStructure,
        paymentMethods,
      };
    } catch (error) {
      throw new Error(`Error en información de precios: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

