import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { sessionStorage } from '../storage/session-storage';

/**
 * Preference_Tool: Gestión de preferencias de usuario y memoria a largo plazo
 * 
 * Recupera y almacena ubicaciones guardadas, preferencias de ruta,
 * y accede al historial de viajes del usuario.
 */
export const preferenceTool = createTool({
  id: 'preference',
  description: `Gestiona preferencias de usuario y memoria a largo plazo.
    Permite recuperar ubicaciones guardadas (ej: "Casa", "Trabajo"),
    almacenar preferencias de ruta, y acceder al historial de viajes.`,
  inputSchema: z.object({
    action: z.enum([
      'get_saved_locations',
      'save_location',
      'get_preferences',
      'update_preferences',
      'get_trip_history',
    ]).describe('Acción a realizar sobre preferencias'),
    locationName: z.string().optional().describe('Nombre de la ubicación guardada (ej: "Casa", "Trabajo")'),
    location: z.object({
      name: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
    }).optional().describe('Información de ubicación a guardar'),
    preferences: z.object({
      avoidTolls: z.boolean().optional().describe('Evitar autopistas de peaje'),
      avoidHighways: z.boolean().optional().describe('Evitar autopistas'),
      preferredVehicleType: z.enum(['economy', 'comfort', 'premium']).optional().describe('Tipo de vehículo preferido'),
    }).optional().describe('Preferencias de viaje a actualizar'),
  }),
  outputSchema: z.object({
    savedLocations: z.array(z.object({
      name: z.string(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      lastUsed: z.string().optional().describe('Fecha de último uso (ISO format)'),
    })).optional().describe('Ubicaciones guardadas del usuario'),
    preferences: z.object({
      avoidTolls: z.boolean(),
      avoidHighways: z.boolean(),
      preferredVehicleType: z.string(),
    }).optional().describe('Preferencias actuales del usuario'),
    tripHistory: z.array(z.object({
      origin: z.string(),
      destination: z.string(),
      date: z.string(),
      price: z.number(),
    })).optional().describe('Historial de viajes del usuario'),
  }),
  execute: async ({ context }) => {
    const { action, locationName, location, preferences } = context;
    
    try {
      // Obtener datos de preferencias del almacenamiento de sesión
      // En producción, esto se reemplazaría con acceso a base de datos
      const savedLocations = sessionStorage.getSavedLocations();
      const userPreferences = sessionStorage.getPreferences();
      const tripHistory = sessionStorage.getTripHistory();
      
      let updatedLocations = [...savedLocations];
      let updatedPreferences = { ...userPreferences };
      let updatedHistory = [...tripHistory];
      
      switch (action) {
        case 'get_saved_locations':
          // Retornar ubicaciones guardadas
          break;
          
        case 'save_location':
          if (!location || !locationName) {
            throw new Error('Nombre y ubicación requeridos para guardar');
          }
          // Buscar si ya existe
          const existingIndex = updatedLocations.findIndex(loc => loc.name.toLowerCase() === locationName.toLowerCase());
          const locationData = {
            name: location.name,
            coordinates: location.coordinates,
            lastUsed: new Date().toISOString(),
          };
          
          if (existingIndex >= 0) {
            updatedLocations[existingIndex] = locationData;
          } else {
            updatedLocations.push(locationData);
          }
          
          // Guardar en almacenamiento de sesión
          sessionStorage.setSavedLocations(updatedLocations);
          break;
          
        case 'get_preferences':
          // Retornar preferencias actuales
          break;
          
        case 'update_preferences':
          if (!preferences) {
            throw new Error('Preferencias requeridas para actualizar');
          }
          updatedPreferences = {
            ...updatedPreferences,
            ...preferences,
          };
          
          // Guardar en almacenamiento de sesión
          sessionStorage.setPreferences(updatedPreferences);
          break;
          
        case 'get_trip_history':
          // Retornar historial
          break;
          
        default:
          throw new Error(`Acción no reconocida: ${action}`);
      }
      
      // Formatear respuesta
      const response: any = {};
      
      if (action === 'get_saved_locations' || action === 'save_location') {
        response.savedLocations = updatedLocations;
      }
      
      if (action === 'get_preferences' || action === 'update_preferences') {
        response.preferences = updatedPreferences;
      }
      
      if (action === 'get_trip_history') {
        response.tripHistory = updatedHistory;
      }
      
      return response;
    } catch (error) {
      throw new Error(`Error en gestión de preferencias: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

