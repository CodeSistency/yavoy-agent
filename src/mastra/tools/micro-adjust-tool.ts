import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * MicroAdjust_Tool: Ajuste de micro-ubicación basado en movimientos relativos
 * 
 * Calcula nuevas coordenadas GPS desde un punto de anclaje basándose en
 * instrucciones de movimiento relativo en lenguaje natural.
 */
export const microAdjustTool = createTool({
  id: 'micro-adjust',
  description: `Ajusta una ubicación GPS basándose en movimientos relativos.
    Procesa instrucciones como "10 metros a la derecha", "dos calles al frente", etc.
    El LLM debe extraer los parámetros estructurados del lenguaje natural antes de llamar esta herramienta.`,
  inputSchema: z.object({
    anchorPoint: z.object({
      latitude: z.number().describe('Latitud del punto de anclaje'),
      longitude: z.number().describe('Longitud del punto de anclaje'),
    }).describe('Punto GPS de referencia desde el cual se realiza el movimiento'),
    instruction: z.object({
      direction: z.enum([
        'north', 'south', 'east', 'west',
        'northeast', 'northwest', 'southeast', 'southwest',
        'forward', 'backward', 'left', 'right',
      ]).describe('Dirección cardinal o relativa del movimiento'),
      distance: z.number().optional().describe('Distancia en metros (requerido para movimientos directos)'),
      relativeDirection: z.string().optional().describe('Descripción textual de la dirección relativa (ej: "derecha", "izquierda")'),
      constraints: z.object({
        streets: z.number().optional().describe('Número de calles a avanzar (ej: "dos calles" = 2)'),
        landmark: z.string().optional().describe('Punto de referencia (ej: "esquina", "semáforo")'),
      }).optional().describe('Restricciones adicionales del movimiento'),
    }).describe('Instrucción de movimiento relativo'),
  }),
  outputSchema: z.object({
    newLocation: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).describe('Nueva ubicación calculada'),
    calculationMethod: z.enum(['trigonometry', 'street-based']).describe('Método usado para el cálculo'),
    confidence: z.number().min(0).max(1).describe('Nivel de confianza en el cálculo (0-1)'),
  }),
  execute: async ({ context }) => {
    const { anchorPoint, instruction } = context;
    
    try {
      // Convertir dirección relativa a cardinal si es necesario
      const cardinalDirection = normalizeDirection(instruction.direction, instruction.relativeDirection);
      
      // Si hay restricción de calles, usar método basado en calles (requeriría API de routing)
      // Por ahora, usamos trigonometría para todos los casos
      if (instruction.constraints?.streets) {
        // Para movimientos basados en calles, estimar distancia promedio
        // Una calle típica tiene ~100-200 metros
        const estimatedStreetDistance = (instruction.constraints.streets || 1) * 150;
        const newLocation = calculateNewLocation(
          anchorPoint.latitude,
          anchorPoint.longitude,
          cardinalDirection,
          estimatedStreetDistance
        );
        
        return {
          newLocation,
          calculationMethod: 'street-based' as const,
          confidence: 0.7, // Menor confianza para estimaciones basadas en calles
        };
      }
      
      // Usar distancia proporcionada o valor por defecto
      const distance = instruction.distance || 10; // Default: 10 metros
      
      const newLocation = calculateNewLocation(
        anchorPoint.latitude,
        anchorPoint.longitude,
        cardinalDirection,
        distance
      );
      
      // Calcular confianza basada en la precisión de los parámetros
      let confidence = 0.9;
      if (!instruction.distance) {
        confidence = 0.7; // Menor confianza si no se especificó distancia
      }
      if (instruction.constraints?.landmark) {
        confidence = 0.6; // Menor confianza para movimientos basados en landmarks
      }
      
      return {
        newLocation,
        calculationMethod: 'trigonometry' as const,
        confidence,
      };
    } catch (error) {
      throw new Error(`Error en ajuste de ubicación: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

/**
 * Normaliza direcciones relativas a direcciones cardinales
 */
function normalizeDirection(
  direction: string,
  relativeDirection?: string
): 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest' {
  // Si ya es una dirección cardinal, retornarla
  if (['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'].includes(direction)) {
    return direction as any;
  }
  
  // Mapear direcciones relativas comunes
  const relativeMap: Record<string, 'north' | 'south' | 'east' | 'west'> = {
    'forward': 'north',
    'backward': 'south',
    'right': 'east',
    'left': 'west',
  };
  
  if (relativeMap[direction]) {
    return relativeMap[direction];
  }
  
  // Intentar inferir desde relativeDirection
  if (relativeDirection) {
    const lower = relativeDirection.toLowerCase();
    if (lower.includes('derecha') || lower.includes('right')) return 'east';
    if (lower.includes('izquierda') || lower.includes('left')) return 'west';
    if (lower.includes('adelante') || lower.includes('frente') || lower.includes('forward')) return 'north';
    if (lower.includes('atrás') || lower.includes('back') || lower.includes('backward')) return 'south';
  }
  
  // Default: norte
  return 'north';
}

/**
 * Calcula nueva ubicación usando trigonometría
 */
function calculateNewLocation(
  lat: number,
  lon: number,
  direction: string,
  distanceMeters: number
): { latitude: number; longitude: number } {
  const R = 6371000; // Radio de la Tierra en metros
  
  // Convertir distancia a grados (aproximación para distancias cortas)
  const latOffset = distanceMeters / R * (180 / Math.PI);
  const lonOffset = distanceMeters / (R * Math.cos(lat * Math.PI / 180)) * (180 / Math.PI);
  
  let newLat = lat;
  let newLon = lon;
  
  switch (direction) {
    case 'north':
      newLat += latOffset;
      break;
    case 'south':
      newLat -= latOffset;
      break;
    case 'east':
      newLon += lonOffset;
      break;
    case 'west':
      newLon -= lonOffset;
      break;
    case 'northeast':
      newLat += latOffset * 0.707; // cos(45°)
      newLon += lonOffset * 0.707; // sin(45°)
      break;
    case 'northwest':
      newLat += latOffset * 0.707;
      newLon -= lonOffset * 0.707;
      break;
    case 'southeast':
      newLat -= latOffset * 0.707;
      newLon += lonOffset * 0.707;
      break;
    case 'southwest':
      newLat -= latOffset * 0.707;
      newLon -= lonOffset * 0.707;
      break;
    default:
      // Default: norte
      newLat += latOffset;
  }
  
  return {
    latitude: Math.round(newLat * 1000000) / 1000000, // Precisión de ~10cm
    longitude: Math.round(newLon * 1000000) / 1000000,
  };
}

