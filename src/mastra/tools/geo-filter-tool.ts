import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface GeocodingCandidate {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  confidence: number;
  country?: string;
  city?: string;
}

/**
 * GeoFilter_Tool: Geocodificación estructurada y filtrada con contexto
 * 
 * Esta herramienta toma una ubicación textual y contexto de sesión para
 * devolver una lista de candidatos GPS, priorizando el contexto local.
 */
export const geoFilterTool = createTool({
  id: 'geo-filter',
  description: `Geocodifica una ubicación textual con filtrado por contexto.
    Prioriza ubicaciones basadas en el contexto proporcionado (país, ciudad, ubicación de sesión).
    Retorna múltiples candidatos para permitir desambiguación cuando sea necesario.`,
  inputSchema: z.object({
    location: z.string().describe('Nombre de la ubicación a buscar (ej: "New York", "Rua das Flores")'),
    context: z.object({
      country: z.string().optional().describe('País para filtrar resultados (ej: "Brasil")'),
      city: z.string().optional().describe('Ciudad para filtrar resultados (ej: "Rio de Janeiro")'),
      sessionLocation: z.object({
        lat: z.number(),
        lng: z.number(),
      }).optional().describe('Ubicación actual del usuario para priorizar resultados cercanos'),
    }).optional().describe('Contexto para filtrar y priorizar resultados de geocodificación'),
  }),
  outputSchema: z.object({
    candidates: z.array(z.object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string(),
      address: z.string(),
      confidence: z.number().min(0).max(1),
      country: z.string().optional(),
      city: z.string().optional(),
    })).describe('Lista de candidatos de ubicación ordenados por relevancia'),
  }),
  execute: async ({ context }) => {
    const { location, context: filterContext } = context;
    
    try {
      // Usar OpenStreetMap Nominatim API (gratuita, no requiere API key)
      // En producción, usar Google Maps Geocoding API para mejor precisión
      const baseUrl = 'https://nominatim.openstreetmap.org/search';
      const params = new URLSearchParams({
        q: location,
        format: 'json',
        limit: '5',
        addressdetails: '1',
      });

      // Aplicar filtros de contexto si están disponibles
      if (filterContext?.country) {
        params.append('countrycodes', filterContext.country.toLowerCase().slice(0, 2));
      }
      if (filterContext?.city) {
        params.append('city', filterContext.city);
      }

      const response = await fetch(`${baseUrl}?${params.toString()}`, {
        headers: {
          'User-Agent': 'MobilityAgent/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.statusText}`);
      }

      const data = await response.json() as Array<{
        lat: string;
        lon: string;
        display_name: string;
        address?: {
          country?: string;
          city?: string;
          town?: string;
          state?: string;
        };
        importance?: number;
      }>;

      if (!data || data.length === 0) {
        return {
          candidates: [],
        };
      }

      // Convertir resultados a formato estructurado
      const candidates: GeocodingCandidate[] = data.map((item, index) => {
        // Calcular confianza basada en importancia y posición en resultados
        const baseConfidence = item.importance ? Math.min(1, item.importance) : 0.8;
        const positionBonus = (data.length - index) / data.length * 0.2;
        let confidence = Math.min(1, baseConfidence + positionBonus);

        // Bonus de confianza si coincide con contexto
        if (filterContext?.country && item.address?.country?.toLowerCase().includes(filterContext.country.toLowerCase())) {
          confidence = Math.min(1, confidence + 0.1);
        }
        if (filterContext?.city && (
          item.address?.city?.toLowerCase().includes(filterContext.city.toLowerCase()) ||
          item.address?.town?.toLowerCase().includes(filterContext.city.toLowerCase())
        )) {
          confidence = Math.min(1, confidence + 0.1);
        }

        // Calcular distancia si hay ubicación de sesión
        if (filterContext?.sessionLocation) {
          const distance = calculateDistance(
            parseFloat(item.lat),
            parseFloat(item.lon),
            filterContext.sessionLocation.lat,
            filterContext.sessionLocation.lng
          );
          // Bonus por cercanía (máximo 5km)
          if (distance < 5000) {
            confidence = Math.min(1, confidence + 0.1 * (1 - distance / 5000));
          }
        }

        return {
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          name: item.display_name.split(',')[0], // Primer elemento del nombre
          address: item.display_name,
          confidence: Math.round(confidence * 100) / 100,
          country: item.address?.country,
          city: item.address?.city || item.address?.town,
        };
      });

      // Ordenar por confianza descendente
      candidates.sort((a, b) => b.confidence - a.confidence);

      return {
        candidates,
      };
    } catch (error) {
      throw new Error(`Error en geocodificación: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

/**
 * Calcula la distancia en metros entre dos puntos GPS usando la fórmula de Haversine
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

