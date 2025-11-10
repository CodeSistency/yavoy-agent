import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { sessionStorage } from '../storage/session-storage';

/**
 * TripState_Tool: Gestión del estado del viaje
 * 
 * Permite actualizar y consultar el estado del viaje (origen, destino, waypoints).
 * El estado se almacena en memoria de sesión del agente.
 */
export const tripStateTool = createTool({
  id: 'trip-state',
  description: `Gestiona el estado del viaje (origen, destino, waypoints).
    Permite establecer, actualizar, consultar o limpiar el estado del viaje.
    El estado se mantiene en la memoria de sesión del agente.`,
  inputSchema: z.object({
    action: z.enum([
      'set_origin',
      'set_destination',
      'add_waypoint',
      'update_origin',
      'update_destination',
      'get_state',
      'clear',
    ]).describe('Acción a realizar sobre el estado del viaje'),
    location: z.object({
      name: z.string().optional().describe('Nombre de la ubicación (ej: "Aeropuerto Internacional")'),
      coordinates: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional().describe('Coordenadas GPS de la ubicación'),
    }).optional().describe('Información de ubicación (requerido para acciones de set/update)'),
    waypointIndex: z.number().optional().describe('Índice del waypoint a modificar (para waypoints múltiples)'),
  }),
  outputSchema: z.object({
    tripState: z.object({
      origin: z.object({
        name: z.string(),
        coordinates: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
      }).optional(),
      destination: z.object({
        name: z.string(),
        coordinates: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
      }).optional(),
      waypoints: z.array(z.object({
        name: z.string(),
        coordinates: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
      })).describe('Puntos intermedios del viaje'),
      status: z.enum(['draft', 'ready', 'in_progress', 'completed']).describe('Estado actual del viaje'),
    }).describe('Estado completo del viaje'),
  }),
  execute: async ({ context }) => {
    const { action, location, waypointIndex } = context;
    
    try {
      // Obtener estado actual del almacenamiento de sesión
      // En producción, esto se reemplazaría con acceso a base de datos
      const currentState = sessionStorage.getTripState();
      
      let newState = { ...currentState };
      
      switch (action) {
        case 'set_origin':
        case 'update_origin':
          if (!location || !location.coordinates) {
            throw new Error('Ubicación con coordenadas requerida para establecer origen');
          }
          newState.origin = {
            name: location.name || 'Origen',
            coordinates: {
              lat: location.coordinates.latitude,
              lng: location.coordinates.longitude,
            },
          };
          // Si hay origen y destino, el estado está listo
          if (newState.destination) {
            newState.status = 'ready';
          }
          break;
          
        case 'set_destination':
        case 'update_destination':
          if (!location || !location.coordinates) {
            throw new Error('Ubicación con coordenadas requerida para establecer destino');
          }
          newState.destination = {
            name: location.name || 'Destino',
            coordinates: {
              lat: location.coordinates.latitude,
              lng: location.coordinates.longitude,
            },
          };
          // Si hay origen y destino, el estado está listo
          if (newState.origin) {
            newState.status = 'ready';
          }
          break;
          
        case 'add_waypoint':
          if (!location || !location.coordinates) {
            throw new Error('Ubicación con coordenadas requerida para agregar waypoint');
          }
          newState.waypoints = newState.waypoints || [];
          newState.waypoints.push({
            name: location.name || `Waypoint ${newState.waypoints.length + 1}`,
            coordinates: {
              lat: location.coordinates.latitude,
              lng: location.coordinates.longitude,
            },
          });
          break;
          
        case 'get_state':
          // Solo retornar estado actual, no modificar
          break;
          
        case 'clear':
          newState = {
            origin: undefined,
            destination: undefined,
            waypoints: [],
            status: 'draft' as const,
          };
          break;
          
        default:
          throw new Error(`Acción no reconocida: ${action}`);
      }
      
      // Guardar nuevo estado en almacenamiento de sesión
      sessionStorage.setTripState(newState);
      
      // Formatear respuesta
      return {
        tripState: {
          origin: newState.origin,
          destination: newState.destination,
          waypoints: newState.waypoints || [],
          status: newState.status,
        },
      };
    } catch (error) {
      throw new Error(`Error en gestión de estado de viaje: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

