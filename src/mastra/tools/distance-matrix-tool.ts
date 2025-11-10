import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * DistanceMatrix_Tool: Estimación de precios usando Google Maps Distance Matrix API
 * 
 * Esta herramienta usa la Distance Matrix API de Google Maps para obtener
 * distancia y tiempo estimado entre origen y destino, y luego calcula
 * precios estimados para diferentes tipos de vehículos.
 * 
 * Se usa ANTES de calcular la ruta completa para mostrar opciones de precio al usuario.
 */
export const distanceMatrixTool = createTool({
  id: 'distance-matrix',
  description: `Obtiene distancia y tiempo estimado usando Google Maps Distance Matrix API
    y calcula precios estimados para diferentes tipos de vehículos (moto, economy, comfort, premium, xl).
    Usa esta herramienta cuando tengas origen y destino con coordenadas para mostrar opciones de precio al usuario
    ANTES de calcular la ruta completa.`,
  inputSchema: z.object({
    origin: z.union([
      // Formato directo: { latitude, longitude }
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
      // Formato con coordinates: { coordinates: { latitude, longitude }, name? }
      z.object({
        coordinates: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        name: z.string().optional(),
      }),
    ]).describe('Coordenadas GPS del origen'),
    destination: z.union([
      // Formato directo: { latitude, longitude }
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
      // Formato con coordinates: { coordinates: { latitude, longitude }, name? }
      z.object({
        coordinates: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        name: z.string().optional(),
      }),
    ]).describe('Coordenadas GPS del destino'),
  }),
  outputSchema: z.object({
    distance: z.number().describe('Distancia en metros'),
    duration: z.number().describe('Duración estimada en segundos'),
    pricingOptions: z.array(z.object({
      vehicleType: z.enum(['moto', 'economy', 'comfort', 'premium', 'xl']).describe('Tipo de vehículo'),
      estimatedPrice: z.number().describe('Precio estimado en moneda local'),
      currency: z.string().describe('Código de moneda'),
      breakdown: z.object({
        baseFare: z.number(),
        distanceFare: z.number(),
        timeFare: z.number(),
      }).describe('Desglose del precio'),
    })).describe('Opciones de precio para cada tipo de vehículo'),
    estimatedDuration: z.string().describe('Duración estimada en formato legible (ej: "45 minutos")'),
    warning: z.string().optional().describe('Advertencia si se usó cálculo estimado'),
  }),
  execute: async ({ context }) => {
    const { origin, destination } = context;
    
    try {
      // Normalizar formato de coordenadas
      const normalizeCoordinates = (location: any): { latitude: number; longitude: number } => {
        if (location.latitude !== undefined && location.longitude !== undefined) {
          return { latitude: location.latitude, longitude: location.longitude };
        }
        if (location.coordinates?.latitude !== undefined && location.coordinates?.longitude !== undefined) {
          return { 
            latitude: location.coordinates.latitude, 
            longitude: location.coordinates.longitude 
          };
        }
        throw new Error('Formato de coordenadas no válido');
      };

      const normalizedOrigin = normalizeCoordinates(origin);
      const normalizedDestination = normalizeCoordinates(destination);

      // Usar Google Maps Distance Matrix API
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      let distance: number;
      let duration: number;
      let warning: string | undefined;

      if (!apiKey) {
        // Fallback a cálculo estimado si no hay API key
        console.warn('[Distance Matrix] GOOGLE_MAPS_API_KEY no configurada, usando cálculo estimado');
        const estimated = estimateDistanceAndDuration(normalizedOrigin, normalizedDestination);
        distance = estimated.distance;
        duration = estimated.duration;
        warning = 'Cálculo estimado (API key no configurada). Para mayor precisión, configura GOOGLE_MAPS_API_KEY.';
      } else {
        // Construir URL para Google Maps Distance Matrix API
        const matrixUrl = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
        matrixUrl.searchParams.set('origins', `${normalizedOrigin.latitude},${normalizedOrigin.longitude}`);
        matrixUrl.searchParams.set('destinations', `${normalizedDestination.latitude},${normalizedDestination.longitude}`);
        matrixUrl.searchParams.set('key', apiKey);
        matrixUrl.searchParams.set('language', 'es');
        matrixUrl.searchParams.set('units', 'metric');

        console.log('[Distance Matrix] Llamando a Google Maps Distance Matrix API');
        
        const response = await fetch(matrixUrl.toString());
        
        if (!response.ok) {
          throw new Error(`Google Maps Distance Matrix API error: ${response.statusText}`);
        }
        
        const matrixData = await response.json();
        
        // Verificar estado de la respuesta
        if (matrixData.status === 'OK' && matrixData.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const element = matrixData.rows[0].elements[0];
          distance = element.distance.value; // en metros
          duration = element.duration.value; // en segundos
        } else {
          // Si hay error, usar cálculo estimado como fallback
          console.warn('[Distance Matrix] Error en respuesta, usando cálculo estimado');
          const estimated = estimateDistanceAndDuration(normalizedOrigin, normalizedDestination);
          distance = estimated.distance;
          duration = estimated.duration;
          warning = 'No se pudo obtener distancia precisa de Google Maps. Se usó un cálculo estimado.';
        }
      }

      // Calcular precios para todos los tipos de vehículos
      const pricingOptions = calculatePricingForAllVehicles(distance, duration);

      // Formatear duración
      const durationMinutes = Math.round(duration / 60);
      const estimatedDuration = durationMinutes === 1 
        ? '1 minuto' 
        : `${durationMinutes} minutos`;

      return {
        distance: Math.round(distance),
        duration: Math.round(duration),
        pricingOptions,
        estimatedDuration,
        warning,
      };
    } catch (error) {
      throw new Error(`Error en Distance Matrix: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

/**
 * Calcula distancia y duración estimada usando fórmula de Haversine
 */
function estimateDistanceAndDuration(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): { distance: number; duration: number } {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLon = toRad(destination.longitude - origin.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(origin.latitude)) * Math.cos(toRad(destination.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Estimar duración (velocidad promedio urbana: ~30 km/h)
  const avgSpeedKmh = 30;
  const avgSpeedMs = (avgSpeedKmh * 1000) / 3600; // m/s
  const duration = distance / avgSpeedMs;

  return { distance, duration };
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calcula precios para todos los tipos de vehículos
 */
function calculatePricingForAllVehicles(
  distanceMeters: number,
  durationSeconds: number
): Array<{
  vehicleType: 'moto' | 'economy' | 'comfort' | 'premium' | 'xl';
  estimatedPrice: number;
  currency: string;
  breakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
  };
}> {
  const distanceKm = distanceMeters / 1000;
  const durationMinutes = durationSeconds / 60;
  
  // Tarifas base (en USD, ajustar según mercado)
  const baseFares = {
    moto: 1.5,
    economy: 2.5,
    comfort: 4.0,
    premium: 6.0,
    xl: 5.0,
  };
  
  const perKmRates = {
    moto: 0.8,
    economy: 1.2,
    comfort: 1.8,
    premium: 2.5,
    xl: 2.0,
  };
  
  const perMinuteRates = {
    moto: 0.15,
    economy: 0.25,
    comfort: 0.35,
    premium: 0.50,
    xl: 0.40,
  };
  
  const vehicleTypes: Array<'moto' | 'economy' | 'comfort' | 'premium' | 'xl'> = 
    ['moto', 'economy', 'comfort', 'premium', 'xl'];
  
  return vehicleTypes.map(vehicleType => {
    const baseFare = baseFares[vehicleType];
    const distanceFare = distanceKm * perKmRates[vehicleType];
    const timeFare = durationMinutes * perMinuteRates[vehicleType];
    const estimatedPrice = baseFare + distanceFare + timeFare;
    
    return {
      vehicleType,
      estimatedPrice: Math.round(estimatedPrice * 100) / 100,
      currency: 'USD',
      breakdown: {
        baseFare: Math.round(baseFare * 100) / 100,
        distanceFare: Math.round(distanceFare * 100) / 100,
        timeFare: Math.round(timeFare * 100) / 100,
      },
    };
  });
}

