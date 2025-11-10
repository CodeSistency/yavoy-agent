import { createTool } from '@mastra/core/tools';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { extractPlacesFromGrounding, getContextToken, type GroundingMetadata } from '../utils/grounding-processor';

/**
 * GoogleMapsGrounding_Tool: Búsqueda de ubicaciones usando Google Maps Grounding nativo de Gemini
 * 
 * Esta herramienta usa la capacidad nativa de Gemini para buscar lugares en Google Maps.
 * Aprovecha el grounding metadata que Gemini proporciona automáticamente cuando
 * se usa la herramienta googleMaps.
 * 
 * Ventajas sobre geocodificación tradicional:
 * - Mayor precisión y contexto
 * - Información enriquecida de lugares
 * - placeId para uso con otras APIs de Google Maps
 * - Context token para integración con Maps widget
 */
export const googleMapsGroundingTool = createTool({
  id: 'google-maps-grounding',
  description: `Busca ubicaciones usando Google Maps Grounding nativo de Gemini.
    Esta herramienta aprovecha las capacidades nativas de Gemini para buscar lugares
    en Google Maps con alta precisión. Retorna placeId, título, y URI de los lugares encontrados.
    Usa la ubicación del usuario (si está disponible) para priorizar resultados cercanos.`,
  inputSchema: z.object({
    query: z.string().describe('Consulta de búsqueda de ubicación (ej: "Aeropuerto Internacional", "Restaurante italiano cerca de aquí")'),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional().describe('Ubicación actual del usuario para priorizar resultados cercanos'),
    maxResults: z.number().optional().default(5).describe('Número máximo de resultados a retornar'),
  }),
  outputSchema: z.object({
    places: z.array(z.object({
      placeId: z.string().describe('ID único del lugar en Google Maps (sin prefijo "places/")'),
      title: z.string().describe('Nombre del lugar'),
      uri: z.string().optional().describe('URI del lugar en Google Maps'),
    })).describe('Lista de lugares encontrados, ordenados por relevancia'),
    contextToken: z.string().optional().describe('Token de contexto para integración con Maps widget'),
    query: z.string().describe('Query original procesada'),
  }),
  execute: async ({ context }) => {
    const { query, location, maxResults = 5 } = context;

    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY no está configurada. Configura la variable de entorno GOOGLE_API_KEY');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Usar modelo que soporta Google Maps Grounding
      // gemini-2.5-flash-lite es más rápido y económico
      // gemini-2.0-flash-exp puede tener mejor precisión
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
      });

      // Configurar herramientas: Google Maps Grounding es nativo
      const tools: any[] = [{ googleMaps: {} }];

      // Configurar toolConfig con ubicación del usuario si está disponible
      let toolConfig: any = undefined;
      if (location) {
        toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
          },
        };
      }

      // Construir prompt para búsqueda
      const searchPrompt = `Busca lugares relacionados con: ${query}. 
        ${location ? `Prioriza resultados cercanos a las coordenadas ${location.latitude}, ${location.longitude}.` : ''}
        Retorna información de lugares encontrados.`;

      console.log('[Google Maps Grounding] Buscando:', query);
      if (location) {
        console.log('[Google Maps Grounding] Con ubicación:', location);
      }

      // Llamar a Gemini con Google Maps Grounding
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: searchPrompt }],
        }],
        tools,
        toolConfig,
      });

      const response = result.response;
      const candidate = response.candidates?.[0];

      // Extraer grounding metadata
      const metadata = candidate?.groundingMetadata as GroundingMetadata | undefined;

      if (!metadata) {
        console.warn('[Google Maps Grounding] No se encontró grounding metadata en la respuesta');
        return {
          places: [],
          query,
        };
      }

      // Procesar grounding chunks para extraer lugares
      const places = extractPlacesFromGrounding(metadata);
      const contextToken = getContextToken(metadata);

      // Limitar resultados
      const limitedPlaces = places.slice(0, maxResults);

      console.log(`[Google Maps Grounding] Encontrados ${limitedPlaces.length} lugares`);

      return {
        places: limitedPlaces.map(place => ({
          placeId: place.placeId,
          title: place.title,
          uri: place.uri,
        })),
        contextToken,
        query,
      };
    } catch (error) {
      console.error('[Google Maps Grounding] Error:', error);
      throw new Error(
        `Error en búsqueda con Google Maps Grounding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
});

