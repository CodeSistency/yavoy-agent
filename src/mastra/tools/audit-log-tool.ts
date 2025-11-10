import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * AuditLog_Tool: Registro de eventos y observabilidad
 * 
 * Registra cada paso de la orquestación, decisiones del LLM, y errores
 * para permitir auditoría, debugging y análisis posterior.
 */
export const auditLogTool = createTool({
  id: 'audit-log',
  description: `Registra eventos del sistema para observabilidad y auditoría.
    Registra llamadas a herramientas, entradas del usuario, decisiones del agente, y errores.
    Útil para debugging, análisis de comportamiento, y cumplimiento.`,
  inputSchema: z.object({
    event: z.enum([
      'tool_call',
      'user_input',
      'agent_decision',
      'error',
      'trip_created',
      'trip_completed',
    ]).describe('Tipo de evento a registrar'),
    toolName: z.string().optional().describe('Nombre de la herramienta (para eventos tool_call)'),
    input: z.any().optional().describe('Input del evento'),
    output: z.any().optional().describe('Output del evento'),
    error: z.string().optional().describe('Mensaje de error (para eventos error)'),
    metadata: z.record(z.any()).optional().describe('Metadatos adicionales del evento'),
  }),
  outputSchema: z.object({
    logged: z.boolean().describe('Indica si el evento fue registrado exitosamente'),
    logId: z.string().describe('ID único del log generado'),
    timestamp: z.string().describe('Timestamp del evento (ISO format)'),
  }),
  execute: async ({ context, agent }) => {
    const { event, toolName, input, output, error, metadata } = context;
    
    try {
      const timestamp = new Date().toISOString();
      const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const logEntry = {
        logId,
        timestamp,
        event,
        toolName,
        input: input ? JSON.stringify(input) : undefined,
        output: output ? JSON.stringify(output) : undefined,
        error,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
        agentId: agent?.name || 'unknown',
      };
      
      // En producción, esto se enviaría a un sistema de logging centralizado
      // Por ahora, solo loggeamos a consola
      console.log('[AUDIT LOG]', JSON.stringify(logEntry, null, 2));
      
      return {
        logged: true,
        logId,
        timestamp,
      };
    } catch (error) {
      // No fallar si el logging falla, pero registrar el error
      console.error('[AUDIT LOG ERROR]', error);
      return {
        logged: false,
        logId: `error_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
    }
  },
});

