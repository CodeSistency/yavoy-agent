import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * ContextManager_Tool: Gestiona contexto compartido entre agentes
 * 
 * Esta herramienta permite al Orchestrator almacenar y recuperar contexto
 * compartido que puede ser usado por múltiples subagentes. Facilita la
 * coordinación entre agentes y mantiene consistencia en la conversación.
 */
export const contextManagerTool = createTool({
  id: 'context-manager',
  description: `Gestiona contexto compartido entre agentes.
    Permite almacenar información que puede ser accedida por múltiples subagentes,
    como tipo de usuario, preferencias, estado de sesión, etc.`,
  inputSchema: z.object({
    action: z.enum(['get', 'set', 'update', 'clear']).describe('Acción a realizar sobre el contexto'),
    key: z.string().describe('Clave del contexto a gestionar (ej: "userType", "userId", "sessionState")'),
    value: z.any().optional().describe('Valor a almacenar (requerido para set/update)'),
    namespace: z.string().optional().default('shared').describe('Namespace del contexto (shared, mobility, customer, driver)'),
  }),
  outputSchema: z.object({
    success: z.boolean().describe('Indica si la operación fue exitosa'),
    value: z.any().optional().describe('Valor recuperado (para acción get)'),
    message: z.string().describe('Mensaje descriptivo de la operación'),
  }),
  execute: async ({ context, agent }) => {
    const { action, key, value, namespace = 'shared' } = context;
    
    try {
      const fullKey = `${namespace}:${key}`;
      
      if (!agent?.memory) {
        return {
          success: false,
          message: 'Memory no disponible en el agente',
        };
      }
      
      switch (action) {
        case 'get': {
          const storedValue = await agent.memory.get(fullKey);
          return {
            success: true,
            value: storedValue,
            message: storedValue !== undefined 
              ? `Contexto recuperado: ${fullKey}`
              : `Contexto no encontrado: ${fullKey}`,
          };
        }
        
        case 'set': {
          if (value === undefined) {
            return {
              success: false,
              message: 'Valor requerido para acción set',
            };
          }
          await agent.memory.set(fullKey, value);
          return {
            success: true,
            message: `Contexto almacenado: ${fullKey}`,
          };
        }
        
        case 'update': {
          const existingValue = await agent.memory.get(fullKey);
          const updatedValue = existingValue 
            ? { ...existingValue, ...value }
            : value;
          
          if (value === undefined) {
            return {
              success: false,
              message: 'Valor requerido para acción update',
            };
          }
          
          await agent.memory.set(fullKey, updatedValue);
          return {
            success: true,
            message: `Contexto actualizado: ${fullKey}`,
          };
        }
        
        case 'clear': {
          // Nota: Mastra memory puede no tener un método clear directo
          // En su lugar, podemos establecer a null/undefined
          await agent.memory.set(fullKey, undefined);
          return {
            success: true,
            message: `Contexto limpiado: ${fullKey}`,
          };
        }
        
        default:
          return {
            success: false,
            message: `Acción no reconocida: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error en gestión de contexto: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

