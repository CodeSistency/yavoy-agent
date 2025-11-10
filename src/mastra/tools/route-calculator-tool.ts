import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * RouteCalculator_Tool: Cálculo de ruta, distancia, tiempo y precio
 * 
 * Calcula la ruta óptima entre origen y destino, estima tiempo de llegada
 * y calcula precio estimado considerando preferencias del usuario.
 */
export const routeCalculatorTool = createTool({
  id: 'route-calculator',
  description: `Calcula ruta, distancia, tiempo estimado y precio entre origen y destino.
    Considera preferencias del usuario (evitar peajes, autopistas) y tipo de vehículo.
    Retorna información detallada de la ruta y estimación de precio.`,
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
    ]).describe('Coordenadas GPS del origen (puede venir como {latitude, longitude} o {coordinates: {latitude, longitude}, name})'),
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
    ]).describe('Coordenadas GPS del destino (puede venir como {latitude, longitude} o {coordinates: {latitude, longitude}, name})'),
    waypoints: z.array(z.union([
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
      z.object({
        coordinates: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        name: z.string().optional(),
      }),
    ])).optional().describe('Puntos intermedios opcionales'),
    preferences: z.object({
      avoidTolls: z.boolean().optional().describe('Evitar autopistas de peaje'),
      avoidHighways: z.boolean().optional().describe('Evitar autopistas'),
    }).optional().describe('Preferencias de ruta'),
    vehicleType: z.enum(['moto', 'economy', 'comfort', 'premium', 'xl']).optional().describe('Tipo de vehículo para cálculo de precio'),
  }),
  outputSchema: z.object({
    route: z.object({
      distance: z.number().describe('Distancia en metros'),
      duration: z.number().describe('Duración en segundos'),
      polyline: z.string().optional().describe('Polyline codificado para visualización en mapa'),
    }).describe('Información de la ruta'),
    pricing: z.object({
      estimatedPrice: z.number().describe('Precio estimado en moneda local'),
      currency: z.string().describe('Código de moneda (ej: "USD", "BRL")'),
      breakdown: z.object({
        baseFare: z.number().describe('Tarifa base'),
        distanceFare: z.number().describe('Tarifa por distancia'),
        timeFare: z.number().describe('Tarifa por tiempo'),
        surgeMultiplier: z.number().optional().describe('Multiplicador de demanda (surge pricing)'),
      }).describe('Desglose del precio'),
    }).describe('Información de precios'),
    eta: z.object({
      estimatedArrival: z.string().describe('Fecha/hora estimada de llegada (ISO format)'),
      estimatedDuration: z.string().describe('Duración estimada en formato legible (ej: "15 minutos")'),
    }).describe('Estimación de tiempo de llegada'),
    warning: z.string().optional().describe('Advertencia sobre el cálculo (ej: si se usó cálculo estimado en lugar de Google Maps)'),
  }),
  execute: async ({ context }) => {
    const { origin, destination, waypoints, preferences, vehicleType } = context;
    
    try {
      // Normalizar formato de coordenadas (aceptar tanto {latitude, longitude} como {coordinates: {latitude, longitude}})
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
        throw new Error('Formato de coordenadas no válido. Se espera {latitude, longitude} o {coordinates: {latitude, longitude}}');
      };

      const normalizedOrigin = normalizeCoordinates(origin);
      const normalizedDestination = normalizeCoordinates(destination);
      const normalizedWaypoints = waypoints?.map(wp => normalizeCoordinates(wp));
      // Usar Google Maps Directions API
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        // Fallback a cálculo estimado si no hay API key
        console.warn('[Route Calculator] GOOGLE_MAPS_API_KEY no configurada, usando cálculo estimado');
        const routeData = estimateRoute(normalizedOrigin, normalizedDestination, normalizedWaypoints);
        const pricing = calculatePricing(routeData.distance, routeData.duration, vehicleType || 'economy');
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + routeData.duration * 1000);
        const durationMinutes = Math.round(routeData.duration / 60);
        
        return {
          route: {
            distance: Math.round(routeData.distance),
            duration: Math.round(routeData.duration),
          },
          pricing,
          eta: {
            estimatedArrival: arrivalTime.toISOString(),
            estimatedDuration: `${durationMinutes} minutos`,
          },
        };
      }

      // Construir URL para Google Maps Directions API
      const directionsUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
      
      // Origen y destino (usando coordenadas normalizadas)
      directionsUrl.searchParams.set('origin', `${normalizedOrigin.latitude},${normalizedOrigin.longitude}`);
      directionsUrl.searchParams.set('destination', `${normalizedDestination.latitude},${normalizedDestination.longitude}`);
      directionsUrl.searchParams.set('key', apiKey);
      directionsUrl.searchParams.set('language', 'es'); // Español por defecto
      directionsUrl.searchParams.set('units', 'metric'); // Métricas
      
      // Agregar waypoints si existen (usando coordenadas normalizadas)
      if (normalizedWaypoints && normalizedWaypoints.length > 0) {
        const waypointsStr = normalizedWaypoints
          .map(wp => `${wp.latitude},${wp.longitude}`)
          .join('|');
        directionsUrl.searchParams.set('waypoints', waypointsStr);
      }
      
      // Aplicar preferencias de ruta
      const avoidParams: string[] = [];
      if (preferences?.avoidTolls) {
        avoidParams.push('tolls');
      }
      if (preferences?.avoidHighways) {
        avoidParams.push('highways');
      }
      if (avoidParams.length > 0) {
        directionsUrl.searchParams.set('avoid', avoidParams.join('|'));
      }
      
      console.log('[Route Calculator] Llamando a Google Maps Directions API');
      
      const response = await fetch(directionsUrl.toString());
      
      if (!response.ok) {
        throw new Error(`Google Maps Directions API error: ${response.statusText}`);
      }
      
      const routeData = await response.json();
      
      // Manejar diferentes estados de respuesta de Google Maps Directions API
      if (routeData.status === 'ZERO_RESULTS') {
        // No se encontró ruta - usar cálculo estimado como fallback
        console.warn('[Route Calculator] ZERO_RESULTS from Google Maps - using estimated calculation as fallback');
        const estimatedRoute = estimateRoute(normalizedOrigin, normalizedDestination, normalizedWaypoints);
        const pricing = calculatePricing(estimatedRoute.distance, estimatedRoute.duration, vehicleType || 'economy');
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + estimatedRoute.duration * 1000);
        const durationMinutes = Math.round(estimatedRoute.duration / 60);
        
        return {
          route: {
            distance: Math.round(estimatedRoute.distance),
            duration: Math.round(estimatedRoute.duration),
          },
          pricing,
          eta: {
            estimatedArrival: arrivalTime.toISOString(),
            estimatedDuration: `${durationMinutes} minutos`,
          },
          warning: 'No se encontró una ruta directa en Google Maps. Se usó un cálculo estimado basado en distancia en línea recta. La ruta real puede variar.',
        };
      }
      
      if (routeData.status !== 'OK') {
        // Para otros errores, intentar con cálculo estimado si es posible
        if (routeData.status === 'NOT_FOUND' || routeData.status === 'INVALID_REQUEST') {
          console.warn(`[Route Calculator] ${routeData.status} from Google Maps - using estimated calculation as fallback`);
          const estimatedRoute = estimateRoute(normalizedOrigin, normalizedDestination, normalizedWaypoints);
          const pricing = calculatePricing(estimatedRoute.distance, estimatedRoute.duration, vehicleType || 'economy');
          const now = new Date();
          const arrivalTime = new Date(now.getTime() + estimatedRoute.duration * 1000);
          const durationMinutes = Math.round(estimatedRoute.duration / 60);
          
          return {
            route: {
              distance: Math.round(estimatedRoute.distance),
              duration: Math.round(estimatedRoute.duration),
            },
            pricing,
            eta: {
              estimatedArrival: arrivalTime.toISOString(),
              estimatedDuration: `${durationMinutes} minutos`,
            },
            warning: `Google Maps no pudo calcular la ruta (${routeData.status}). Se usó un cálculo estimado.`,
          };
        }
        
        // Para otros errores críticos, lanzar excepción
        throw new Error(`Google Maps Directions API error: ${routeData.status} - ${routeData.error_message || 'Unknown error'}`);
      }
      
      // Extraer información de la primera ruta (la más óptima)
      const route = routeData.routes[0];
      const leg = route.legs[0]; // Para múltiples waypoints, sumar todos los legs
      
      // Calcular distancia total (sumar todos los legs si hay waypoints)
      let totalDistance = 0;
      let totalDuration = 0;
      for (const leg of route.legs) {
        totalDistance += leg.distance.value; // value está en metros
        totalDuration += leg.duration.value; // value está en segundos
      }
      
      const polyline = route.overview_polyline.points;
      
      // Calcular precio
      const pricing = calculatePricing(totalDistance, totalDuration, vehicleType || 'economy');
      
      // Calcular ETA
      const now = new Date();
      const arrivalTime = new Date(now.getTime() + totalDuration * 1000);
      const durationMinutes = Math.round(totalDuration / 60);
      
      return {
        route: {
          distance: totalDistance,
          duration: totalDuration,
          polyline,
        },
        pricing,
        eta: {
          estimatedArrival: arrivalTime.toISOString(),
          estimatedDuration: `${durationMinutes} minutos`,
        },
      };
    } catch (error) {
      throw new Error(`Error en cálculo de ruta: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

/**
 * Calcula distancia estimada entre puntos (fórmula de Haversine)
 */
function calculateDistance(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLon = toRad(destination.longitude - origin.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(origin.latitude)) * Math.cos(toRad(destination.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estima duración basada en distancia (velocidad promedio urbana: ~30 km/h)
 */
function estimateDuration(distanceMeters: number): number {
  const avgSpeedKmh = 30; // km/h
  const avgSpeedMs = (avgSpeedKmh * 1000) / 3600; // m/s
  return distanceMeters / avgSpeedMs;
}

/**
 * Estima ruta sin API (solo para desarrollo)
 */
function estimateRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  waypoints?: Array<{ latitude: number; longitude: number }>
): { distance: number; duration: number } {
  let totalDistance = calculateDistance(origin, destination);
  
  // Agregar distancia de waypoints si existen
  if (waypoints && waypoints.length > 0) {
    let prevPoint = origin;
    for (const waypoint of waypoints) {
      totalDistance += calculateDistance(prevPoint, waypoint);
      prevPoint = waypoint;
    }
    totalDistance += calculateDistance(prevPoint, destination);
  }
  
  const duration = estimateDuration(totalDistance);
  
  return {
    distance: totalDistance,
    duration,
  };
}

/**
 * Calcula precio basado en distancia, tiempo y tipo de vehículo
 */
function calculatePricing(
  distanceMeters: number,
  durationSeconds: number,
  vehicleType: 'moto' | 'economy' | 'comfort' | 'premium' | 'xl'
): {
  estimatedPrice: number;
  currency: string;
  breakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surgeMultiplier?: number;
  };
} {
  const distanceKm = distanceMeters / 1000;
  const durationMinutes = durationSeconds / 60;
  
  // Tarifas base (en USD, ajustar según mercado)
  // Deben coincidir con las tarifas en distance-matrix-tool.ts
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
  
  const baseFare = baseFares[vehicleType];
  const distanceFare = distanceKm * perKmRates[vehicleType];
  const timeFare = durationMinutes * perMinuteRates[vehicleType];
  
  // Surge pricing (simulado - en producción, basado en demanda real)
  const surgeMultiplier = Math.random() > 0.8 ? 1.2 + Math.random() * 0.3 : 1.0;
  
  const estimatedPrice = (baseFare + distanceFare + timeFare) * surgeMultiplier;
  
  return {
    estimatedPrice: Math.round(estimatedPrice * 100) / 100,
    currency: 'USD',
    breakdown: {
      baseFare: Math.round(baseFare * 100) / 100,
      distanceFare: Math.round(distanceFare * 100) / 100,
      timeFare: Math.round(timeFare * 100) / 100,
      surgeMultiplier: surgeMultiplier > 1.0 ? Math.round(surgeMultiplier * 100) / 100 : undefined,
    },
  };
}

