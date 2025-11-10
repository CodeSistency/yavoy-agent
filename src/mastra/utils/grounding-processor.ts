/**
 * Grounding Processor: Utilidades para procesar metadata de Google Maps Grounding
 * 
 * Extrae y procesa información de lugares desde groundingMetadata
 * que viene en las respuestas de Gemini con Google Maps Grounding habilitado.
 */

export interface GroundingChunk {
  maps?: {
    placeId: string; // Formato: "places/ChIJ..." o "ChIJ..."
    title: string;
    uri: string;
  };
  web?: any;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  contextToken?: string; // Para integración con Maps widget
}

export interface ProcessedPlace {
  placeId: string; // Limpiado: sin prefijo "places/"
  title: string;
  uri: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Extrae lugares de grounding metadata
 */
export function extractPlacesFromGrounding(
  metadata: GroundingMetadata | undefined | null
): ProcessedPlace[] {
  if (!metadata?.groundingChunks) {
    return [];
  }

  const places: ProcessedPlace[] = [];

  for (const chunk of metadata.groundingChunks) {
    if (chunk.maps) {
      // Limpiar placeId: remover prefijo "places/" si existe
      const placeId = chunk.maps.placeId.replace(/^places\//, '');

      places.push({
        placeId,
        title: chunk.maps.title,
        uri: chunk.maps.uri,
        // Nota: Las coordenadas no vienen en groundingChunks,
        // se deben obtener usando Google Maps Places API con el placeId
      });
    }
  }

  return places;
}

/**
 * Obtiene el contextToken de grounding metadata
 * Útil para integración con Google Maps JavaScript API widget
 */
export function getContextToken(
  metadata: GroundingMetadata | undefined | null
): string | undefined {
  return metadata?.contextToken;
}

/**
 * Verifica si hay metadata de grounding disponible
 */
export function hasGroundingMetadata(
  metadata: GroundingMetadata | undefined | null
): boolean {
  return !!(
    metadata?.groundingChunks &&
    metadata.groundingChunks.length > 0
  );
}

/**
 * Obtiene el primer lugar encontrado (útil cuando hay un solo resultado)
 */
export function getFirstPlace(
  metadata: GroundingMetadata | undefined | null
): ProcessedPlace | null {
  const places = extractPlacesFromGrounding(metadata);
  return places.length > 0 ? places[0] : null;
}

