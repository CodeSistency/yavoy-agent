import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Policy_Tool: Información sobre políticas y reglas para conductores
 * 
 * Proporciona información sobre políticas de la plataforma, reglas de conducta,
 * términos de servicio, y qué está permitido o prohibido.
 */
export const policyTool = createTool({
  id: 'policy',
  description: `Proporciona información sobre políticas, reglas y términos de servicio para conductores.
    Responde preguntas sobre qué está permitido, qué está prohibido, políticas de cancelación,
    comportamiento esperado, y consecuencias de violaciones.`,
  inputSchema: z.object({
    question: z.string().describe('Pregunta sobre políticas o reglas'),
    policyType: z.enum(['cancellation', 'behavior', 'vehicle', 'safety', 'other']).optional().describe('Tipo de política si está disponible'),
  }),
  outputSchema: z.object({
    answer: z.string().describe('Respuesta sobre la política o regla'),
    policyType: z.string().describe('Tipo de política'),
    keyPoints: z.array(z.string()).optional().describe('Puntos clave de la política'),
  }),
  execute: async ({ context }) => {
    const { question, policyType } = context;
    
    try {
      const questionLower = question.toLowerCase();
      
      const policies: Record<string, { answer: string; policyType: string; keyPoints?: string[] }> = {
        'cancelar': {
          answer: 'Puedes cancelar un viaje antes de recoger al pasajero sin penalización en la mayoría de casos. Sin embargo, cancelaciones frecuentes o cancelaciones después de aceptar un viaje pueden afectar tu calificación y acceso a viajes. Cancelar después de recoger al pasajero está estrictamente prohibido excepto en casos de emergencia o seguridad.',
          policyType: 'cancellation',
          keyPoints: [
            'Cancelaciones antes de recoger: generalmente permitidas',
            'Cancelaciones frecuentes pueden afectar calificación',
            'Cancelar después de recoger está prohibido',
          ],
        },
        'comportamiento': {
          answer: 'Se espera que todos los conductores mantengan un comportamiento profesional y respetuoso. Esto incluye: tratar a los pasajeros con respeto, mantener el vehículo limpio, seguir las leyes de tránsito, no usar el teléfono mientras conduces, y proporcionar un servicio de calidad. El acoso, discriminación, o comportamiento inapropiado resultará en suspensión o terminación de la cuenta.',
          policyType: 'behavior',
          keyPoints: [
            'Comportamiento profesional y respetuoso requerido',
            'Vehículo limpio y en buen estado',
            'Seguir leyes de tránsito',
            'No acoso o discriminación',
          ],
        },
        'vehículo': {
          answer: 'Tu vehículo debe estar en buen estado, limpio, y cumplir con los requisitos de la plataforma (generalmente modelo 2010 o más reciente). Debes mantener el seguro válido y el registro actualizado. El vehículo debe tener asientos funcionales, cinturones de seguridad, y estar libre de olores fuertes. Inspecciones periódicas pueden ser requeridas.',
          policyType: 'vehicle',
          keyPoints: [
            'Vehículo en buen estado y limpio',
            'Modelo 2010 o más reciente (generalmente)',
            'Seguro y registro válidos',
            'Inspecciones periódicas pueden ser requeridas',
          ],
        },
        'seguridad': {
          answer: 'La seguridad es nuestra prioridad. Debes: verificar la identidad del pasajero antes de iniciar el viaje, seguir las rutas sugeridas, reportar incidentes inmediatamente, y nunca comprometer tu seguridad o la del pasajero. Si te sientes inseguro en cualquier momento, puedes cancelar el viaje y reportar el incidente. El uso de drogas o alcohol está estrictamente prohibido.',
          policyType: 'safety',
          keyPoints: [
            'Verificar identidad del pasajero',
            'Reportar incidentes inmediatamente',
            'No usar drogas o alcohol',
            'Priorizar seguridad en todo momento',
          ],
        },
        'prohibido': {
          answer: 'Está prohibido: discriminar por raza, género, religión u orientación, solicitar pagos en efectivo fuera de la plataforma, cancelar viajes después de recoger al pasajero (excepto emergencias), usar drogas o alcohol, acosar o comportarse inapropiadamente, y violar las leyes de tránsito. Las violaciones pueden resultar en suspensión o terminación permanente.',
          policyType: 'behavior',
          keyPoints: [
            'No discriminación',
            'No pagos fuera de la plataforma',
            'No cancelar después de recoger (excepto emergencias)',
            'No drogas o alcohol',
            'No acoso',
          ],
        },
      };
      
      let answer = '';
      let answerPolicyType = policyType || 'other';
      let keyPoints: string[] = [];
      
      for (const [keyword, data] of Object.entries(policies)) {
        if (questionLower.includes(keyword)) {
          answer = data.answer;
          answerPolicyType = data.policyType;
          keyPoints = data.keyPoints || [];
          break;
        }
      }
      
      if (!answer) {
        answer = 'Nuestras políticas están diseñadas para mantener un servicio seguro y de calidad. ';
        answer += 'Las políticas principales cubren: comportamiento profesional, seguridad, ';
        answer += 'mantenimiento del vehículo, y políticas de cancelación. ';
        answer += 'Si tienes una pregunta específica sobre una política, puedo ayudarte con más detalles.';
        answerPolicyType = 'other';
        keyPoints = ['Comportamiento profesional', 'Seguridad', 'Vehículo', 'Cancelación'];
      }
      
      return {
        answer,
        policyType: answerPolicyType,
        keyPoints,
      };
    } catch (error) {
      throw new Error(`Error en información de políticas: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

