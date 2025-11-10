# Plan de Migración a Google: Gemini + Google Maps Grounding + Gemini Live

## 📋 Resumen Ejecutivo

Este plan describe la migración completa del agente de movilidad a la stack de Google:
- **Gemini** como modelo principal (reemplazando el actual)
- **Google Maps Grounding** como herramienta nativa para búsqueda de ubicaciones
- **Gemini Live** para speech-to-speech (reemplazando OpenAI Realtime)
- **Google Maps APIs** para cálculo de rutas y geocodificación avanzada

## 🎯 Objetivos

1. **Aprovechar herramientas nativas de Google**: Usar Google Maps Grounding integrado en Gemini
2. **Simplificar arquitectura**: Reducir dependencias externas usando capacidades nativas
3. **Mejorar precisión**: Google Maps es más preciso que OpenStreetMap
4. **Speech-to-Speech nativo**: Gemini Live para interacción por voz
5. **Costo optimizado**: Usar herramientas nativas puede ser más eficiente

## 🔍 Análisis del Código de Referencia

Del código proporcionado, identificamos:

```typescript
// Configuración de herramientas nativas de Gemini
const tools: any[] = [{ googleMaps: {} }];
if (request.useSearchGrounding) {
  tools.push({ googleSearchRetrieval: {} });
}

// Configuración con ubicación para contexto
const toolConfig = {
  retrievalConfig: {
    latLng: {
      latitude: request.location.latitude,
      longitude: request.location.longitude,
    },
  },
};

// Extracción de grounding metadata
const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
const contextToken = metadata.contextToken; // Para Maps widget
```

**Características clave:**
- `googleMaps: {}` es una herramienta nativa de Gemini
- `groundingMetadata` contiene información de lugares encontrados
- `contextToken` permite integración con Maps widget
- Los `groundingChunks` contienen `placeId`, `title`, `uri`

## 📦 Dependencias Necesarias

### Nuevas Dependencias

```json
{
  "dependencies": {
    "@google/generative-ai": "^latest",
    "@mastra/voice-google-gemini-live": "^latest",
    "@mastra/node-audio": "^latest",
    "@googlemaps/js-api-loader": "^latest" // Opcional, para UI
  }
}
```

### Variables de Entorno

```env
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key  # Para Directions API
```

## 🏗️ Arquitectura Propuesta

### Opción A: Integración Nativa con Mastra (Preferida)

Si Mastra soporta herramientas nativas de Gemini:

```
MobilityAgent
├── Model: google/gemini-2.5-flash-lite (o gemini-2.0-flash-exp)
├── Native Tools:
│   ├── googleMaps (grounding nativo)
│   └── googleSearchRetrieval (opcional)
├── Custom Tools (mantener):
│   ├── TripState_Tool (gestión de estado)
│   ├── Preference_Tool (preferencias usuario)
│   ├── RouteCalculator_Tool (usando Google Maps Directions API)
│   ├── MicroAdjust_Tool (ajustes relativos)
│   ├── HumanInLoop_Tool (desambiguación)
│   └── AuditLog_Tool (logging)
└── Voice: GeminiLiveVoice
```

### Opción B: Cliente Híbrido (Si Mastra no soporta nativamente)

Si Mastra no soporta herramientas nativas de Gemini directamente:

```
MobilityAgent (Mastra)
├── Model: google/gemini-2.5-pro
├── Custom Tools:
│   ├── GoogleMapsGrounding_Tool (wrapper que usa @google/generative-ai)
│   ├── TripState_Tool
│   ├── Preference_Tool
│   ├── RouteCalculator_Tool (Google Maps Directions API)
│   ├── MicroAdjust_Tool
│   ├── HumanInLoop_Tool
│   └── AuditLog_Tool
└── Voice: GeminiLiveVoice
```

## 📝 Plan de Implementación Detallado

### Fase 1: Investigación y Preparación

#### 1.1 Verificar Soporte de Mastra
- [ ] Investigar si Mastra soporta herramientas nativas de Gemini (`googleMaps: {}`)
- [ ] Revisar documentación de Mastra para configuración de herramientas nativas
- [ ] Verificar si se puede pasar `toolConfig` con `retrievalConfig` a través de Mastra

#### 1.2 Instalación de Dependencias
- [ ] Instalar `@google/generative-ai`
- [ ] Instalar `@mastra/voice-google-gemini-live`
- [ ] Instalar `@mastra/node-audio`
- [ ] Actualizar `package.json`

#### 1.3 Configuración de APIs
- [ ] Obtener `GOOGLE_API_KEY` (para Gemini)
- [ ] Obtener `GOOGLE_MAPS_API_KEY` (para Directions API)
- [ ] Configurar variables de entorno
- [ ] Verificar cuotas y límites de API

### Fase 2: Migración del Modelo y Voz

#### 2.1 Actualizar Agente Principal
- [ ] Cambiar modelo a `google/gemini-2.5-flash-lite` o `gemini-2.0-flash-exp`
- [ ] Configurar `GeminiLiveVoice` en lugar de `OpenAIRealtimeVoice`
- [ ] Actualizar instrucciones del agente para mencionar capacidades de Google Maps

#### 2.2 Configurar Gemini Live
```typescript
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';

voice: new GeminiLiveVoice({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.0-flash-exp',
  speaker: 'Puck', // o otro speaker disponible
  debug: true,
}),
```

### Fase 3: Integración de Google Maps Grounding

#### 3.1 Opción A: Si Mastra soporta herramientas nativas

**Implementación Directa:**
- [ ] Configurar herramientas nativas en el agente:
  ```typescript
  // En la configuración del agente (si Mastra lo soporta)
  tools: {
    googleMaps: {}, // Herramienta nativa
    // ... otras herramientas custom
  }
  ```
- [ ] Pasar `toolConfig` con ubicación del usuario cuando esté disponible
- [ ] Extraer `groundingMetadata` de las respuestas del agente

#### 3.2 Opción B: Si Mastra NO soporta herramientas nativas

**Crear GoogleMapsGrounding_Tool (Wrapper):**

```typescript
// src/mastra/tools/google-maps-grounding-tool.ts
import { createTool } from '@mastra/core/tools';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

export const googleMapsGroundingTool = createTool({
  id: 'google-maps-grounding',
  description: 'Busca ubicaciones usando Google Maps Grounding nativo de Gemini',
  inputSchema: z.object({
    query: z.string().describe('Consulta de búsqueda de ubicación'),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional().describe('Ubicación del usuario para contexto'),
  }),
  outputSchema: z.object({
    places: z.array(z.object({
      placeId: z.string(),
      title: z.string(),
      address: z.string().optional(),
      coordinates: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
    })),
    contextToken: z.string().optional(),
  }),
  execute: async ({ context }) => {
    // Usar GoogleGenerativeAI directamente
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
    });

    const tools = [{ googleMaps: {} }];
    let toolConfig: any = undefined;

    if (context.location) {
      toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: context.location.latitude,
            longitude: context.location.longitude,
          },
        },
      };
    }

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Busca: ${context.query}` }],
      }],
      tools,
      toolConfig,
    });

    const response = result.response;
    const candidate = response.candidates?.[0];
    const metadata = candidate?.groundingMetadata as any;

    // Extraer lugares de groundingChunks
    const places = [];
    if (metadata?.groundingChunks) {
      for (const chunk of metadata.groundingChunks) {
        if (chunk.maps) {
          places.push({
            placeId: chunk.maps.placeId,
            title: chunk.maps.title,
            uri: chunk.maps.uri,
          });
        }
      }
    }

    return {
      places,
      contextToken: metadata?.contextToken,
    };
  },
});
```

### Fase 4: Actualizar Herramientas Existentes

#### 4.1 Reemplazar GeoFilter_Tool

**Opción A: Eliminar y usar Google Maps Grounding directamente**
- [ ] Eliminar `geo-filter-tool.ts`
- [ ] El agente usará `googleMaps` nativo o `googleMapsGroundingTool`
- [ ] Actualizar instrucciones del agente

**Opción B: Refactorizar para usar Google Maps API**
- [ ] Reemplazar OpenStreetMap con Google Maps Geocoding API
- [ ] Mantener la misma interfaz pero con mejor precisión

#### 4.2 Actualizar RouteCalculator_Tool
- [ ] Reemplazar OpenRouteService con Google Maps Directions API
- [ ] Implementar cálculo de rutas con `@googlemaps/js-api-loader` o fetch directo
- [ ] Agregar soporte para waypoints
- [ ] Mejorar cálculo de precios con datos reales de distancia/tiempo

```typescript
// Ejemplo de integración con Google Maps Directions API
const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
  `origin=${origin.lat},${origin.lng}&` +
  `destination=${dest.lat},${dest.lng}&` +
  `key=${process.env.GOOGLE_MAPS_API_KEY}`;

const response = await fetch(directionsUrl);
const data = await response.json();
```

#### 4.3 Mantener Herramientas que No Cambian
- [ ] `TripState_Tool`: Sin cambios (gestión de estado interno)
- [ ] `Preference_Tool`: Sin cambios (almacenamiento local)
- [ ] `MicroAdjust_Tool`: Sin cambios (cálculos geométricos)
- [ ] `HumanInLoop_Tool`: Sin cambios (interacción con usuario)
- [ ] `AuditLog_Tool`: Sin cambios (logging)

### Fase 5: Extracción y Procesamiento de Grounding Metadata

#### 5.1 Crear Utilidad para Procesar Grounding
```typescript
// src/mastra/utils/grounding-processor.ts
export interface GroundingChunk {
  maps?: {
    placeId: string;
    title: string;
    uri: string;
  };
  web?: any;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  contextToken?: string;
}

export function extractPlacesFromGrounding(metadata: GroundingMetadata) {
  const places = [];
  if (metadata.groundingChunks) {
    for (const chunk of metadata.groundingChunks) {
      if (chunk.maps) {
        places.push({
          placeId: chunk.maps.placeId.replace('places/', ''),
          title: chunk.maps.title,
          uri: chunk.maps.uri,
        });
      }
    }
  }
  return places;
}
```

#### 5.2 Integrar en Respuestas del Agente
- [ ] Interceptar respuestas del agente para extraer `groundingMetadata`
- [ ] Procesar `groundingChunks` para obtener lugares
- [ ] Incluir `contextToken` para integración con Maps widget (si aplica)

### Fase 6: Actualización de Instrucciones del Agente

#### 6.1 Actualizar Prompt del Agente
```typescript
instructions: `
  You are a conversational mobility assistant using Google Maps and Gemini.
  
  ## Google Maps Grounding:
  - Use the native googleMaps tool to search for locations
  - The tool automatically provides accurate place information with placeId
  - Use the grounding metadata to get precise location data
  
  ## Location Handling:
  - When user asks for a location, use googleMaps grounding
  - Extract placeId from grounding chunks for precise identification
  - Use placeId for route calculations with Google Maps Directions API
  
  ## Route Calculation:
  - Use routeCalculator tool with placeId or coordinates
  - Google Maps provides accurate distance, time, and route information
  
  // ... resto de instrucciones
`
```

### Fase 7: Testing y Validación

#### 7.1 Tests de Integración
- [ ] Test: Búsqueda de ubicación con Google Maps Grounding
- [ ] Test: Extracción de grounding metadata
- [ ] Test: Cálculo de rutas con Google Maps Directions API
- [ ] Test: Speech-to-speech con Gemini Live
- [ ] Test: Flujo completo de reserva de viaje

#### 7.2 Validación de Precisión
- [ ] Comparar resultados de geocodificación (OpenStreetMap vs Google Maps)
- [ ] Validar precisión de rutas calculadas
- [ ] Verificar que placeId se extrae correctamente

### Fase 8: Documentación y Limpieza

#### 8.1 Actualizar Documentación
- [ ] Actualizar `README.md`` con nuevas dependencias
- [ ] Documentar uso de Google Maps Grounding
- [ ] Actualizar `PLAN.md` con arquitectura final
- [ ] Crear guía de migración

#### 8.2 Limpieza
- [ ] Eliminar código de OpenStreetMap si se reemplaza completamente
- [ ] Eliminar código de OpenRouteService
- [ ] Eliminar referencias a OpenAI Realtime si se migra completamente
- [ ] Actualizar comentarios y documentación inline

## 🔧 Detalles Técnicos

### Configuración de Gemini con Google Maps Grounding

```typescript
// Si se usa directamente con @google/generative-ai
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
});

const tools = [{ googleMaps: {} }];

const toolConfig = {
  retrievalConfig: {
    latLng: {
      latitude: userLocation.lat,
      longitude: userLocation.lng,
    },
  },
};

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: query }] }],
  tools,
  toolConfig,
});
```

### Estructura de Grounding Metadata

```typescript
interface GroundingMetadata {
  groundingChunks: Array<{
    maps?: {
      placeId: string; // "places/ChIJ..."
      title: string;
      uri: string;
    };
    web?: any;
  }>;
  contextToken?: string; // Para Maps widget
}
```

### Integración con Google Maps Directions API

```typescript
// Para cálculo de rutas
const directionsUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
directionsUrl.searchParams.set('origin', `${origin.lat},${origin.lng}`);
directionsUrl.searchParams.set('destination', `${dest.lat},${dest.lng}`);
directionsUrl.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!);
directionsUrl.searchParams.set('language', 'es');
directionsUrl.searchParams.set('region', 'br'); // Si aplica

if (preferences?.avoidTolls) {
  directionsUrl.searchParams.set('avoid', 'tolls');
}
if (preferences?.avoidHighways) {
  directionsUrl.searchParams.append('avoid', 'highways');
}
```

## ⚠️ Consideraciones Importantes

### Limitaciones y Desafíos

1. **Soporte de Mastra**: 
   - Si Mastra no soporta herramientas nativas de Gemini directamente, necesitamos crear un wrapper
   - Verificar si se puede pasar `toolConfig` a través de la configuración del agente

2. **Grounding Metadata**:
   - La extracción de `groundingMetadata` puede requerir acceso directo a la respuesta de Gemini
   - Mastra puede no exponer esta metadata directamente

3. **Costo**:
   - Google Maps API tiene costos por uso
   - Gemini con grounding puede tener costos adicionales
   - Monitorear uso y configurar límites

4. **Rate Limits**:
   - Google Maps API tiene rate limits
   - Implementar retry logic y rate limiting

### Decisiones de Diseño

1. **Estrategia Híbrida**:
   - Usar Google Maps Grounding para búsqueda de lugares
   - Mantener herramientas custom para lógica de negocio (trip state, preferences)
   - Usar Google Maps Directions API para rutas

2. **Fallback**:
   - Si Google Maps Grounding falla, usar Google Maps Geocoding API como fallback
   - Mantener lógica de error handling robusta

## 📊 Métricas de Éxito

- [ ] Precisión de geocodificación > 95%
- [ ] Tiempo de respuesta < 2 segundos
- [ ] Integración de speech-to-speech funcionando
- [ ] Grounding metadata extraído correctamente en > 90% de casos
- [ ] Cálculo de rutas con precisión de Google Maps

## 🚀 Orden de Implementación Recomendado

1. **Fase 1**: Investigación y preparación (1-2 días)
2. **Fase 2**: Migración de modelo y voz (1 día)
3. **Fase 3**: Integración de Google Maps Grounding (2-3 días)
4. **Fase 4**: Actualización de herramientas (2 días)
5. **Fase 5**: Procesamiento de grounding (1 día)
6. **Fase 6**: Actualización de instrucciones (1 día)
7. **Fase 7**: Testing (2 días)
8. **Fase 8**: Documentación (1 día)

**Total estimado: 10-13 días**

## 📝 Notas Adicionales

- El código de referencia muestra que `groundingMetadata` está en `candidate.groundingMetadata`
- `placeId` viene en formato `"places/ChIJ..."` y debe limpiarse
- `contextToken` puede usarse para integración con Maps JavaScript API widget
- Gemini Live requiere configuración específica diferente a OpenAI Realtime

---

**Estado**: Plan creado, esperando confirmación para implementación.

Cuando digas "continuar", procederé con la implementación siguiendo este plan.

