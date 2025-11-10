# Plan de Arquitectura: Agente Conversacional de Movilidad (Uber-like)

## Resumen Ejecutivo

Este documento describe la arquitectura para construir un agente conversacional de movilidad tipo Uber, completamente interactivo con IA, utilizando **Mastra** como framework principal. El agente implementará una arquitectura de **micro-agentes** especializados que convierten lenguaje natural en llamadas estructuradas a herramientas determinísticas.

## Objetivos Principales

1. **Interacción completamente impulsada por IA**: El usuario puede dar comandos complejos y contextuales en lenguaje natural
2. **Robustez y fiabilidad**: Sistema diseñado en torno al modelo, no solo el modelo en sí
3. **Precisión de ubicación**: Manejo de ubicaciones absolutas y relativas ("10 metros a la derecha")
4. **Gestión de estado**: Memoria de sesión y largo plazo para contexto persistente
5. **Speech-to-Speech**: Integración de voz bidireccional en tiempo real

## Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────┐
│              Speech-to-Speech Interface                  │
│         (OpenAI Realtime / Gemini Live)                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Mobility Agent (Orquestador)              │
│  - Intención y estructuración de parámetros            │
│  - Gestión de flujo de control                         │
│  - Memoria de sesión                                    │
└─────┬───────────────────────────────────────────────────┘
      │
      ├──► Tools (Micro-Agentes Especializados)
      │
      ├──► GeoFilter_Tool          (Geocodificación)
      ├──► MicroAdjust_Tool        (Ajustes relativos)
      ├──► TripState_Tool          (Estado de viaje)
      ├──► Preference_Tool         (Preferencias usuario)
      ├──► RouteCalculator_Tool    (Cálculo de rutas)
      ├──► HumanInLoop_Tool        (Desambiguación)
      └──► AuditLog_Tool           (Observabilidad)
```

## Herramientas (Tools) Detalladas

### 1. GeoFilter_Tool
**Propósito**: Geocodificación estructurada y filtrada con contexto

**Funcionalidad**:
- Toma ubicación textual + contexto de sesión
- Devuelve lista de candidatos GPS priorizando contexto local
- LLM estructura la consulta antes de llamar a la API

**Input Schema**:
```typescript
{
  location: string;           // "New York", "Rua das Flores"
  context?: {
    country?: string;          // "Brasil" para filtrar
    city?: string;             // "Rio de Janeiro"
    sessionLocation?: {        // Ubicación actual del usuario
      lat: number;
      lng: number;
    };
  };
}
```

**Output Schema**:
```typescript
{
  candidates: Array<{
    latitude: number;
    longitude: number;
    name: string;
    address: string;
    confidence: number;        // 0-1
    country?: string;
    city?: string;
  }>;
}
```

**Implementación**:
- Usar Google Maps Geocoding API o OpenStreetMap Nominatim
- Aplicar filtros de contexto antes de la búsqueda
- Retornar múltiples candidatos para desambiguación

---

### 2. MicroAdjust_Tool
**Propósito**: Ajuste de micro-ubicación basado en movimientos relativos

**Funcionalidad**:
- Calcula nuevas coordenadas GPS desde un punto de anclaje
- Procesa instrucciones relativas: "10 metros a la derecha", "dos calles al frente"

**Input Schema**:
```typescript
{
  anchorPoint: {
    latitude: number;
    longitude: number;
  };
  instruction: {
    direction: "north" | "south" | "east" | "west" | 
                "northeast" | "northwest" | "southeast" | "southwest" |
                "forward" | "backward" | "left" | "right";
    distance?: number;         // metros
    relativeDirection?: string; // "derecha", "izquierda", "adelante"
    constraints?: {
      streets?: number;         // "dos calles" = 2
      landmark?: string;        // "esquina", "semáforo"
    };
  };
}
```

**Output Schema**:
```typescript
{
  newLocation: {
    latitude: number;
    longitude: number;
  };
  calculationMethod: "trigonometry" | "street-based";
  confidence: number;
}
```

**Implementación**:
- LLM extrae parámetros estructurados del lenguaje natural
- Código determinístico calcula coordenadas usando trigonometría
- Opcionalmente usar APIs de routing para movimientos basados en calles

---

### 3. TripState_Tool
**Propósito**: Gestión del estado del viaje (origen, destino, waypoints)

**Funcionalidad**:
- Actualiza origen, destino o puntos intermedios
- Almacena en memoria de sesión
- Permite consultar estado actual

**Input Schema**:
```typescript
{
  action: "set_origin" | "set_destination" | "add_waypoint" | 
          "update_origin" | "update_destination" | "get_state" | "clear";
  location?: {
    name?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  waypointIndex?: number;      // Para waypoints múltiples
}
```

**Output Schema**:
```typescript
{
  tripState: {
    origin?: {
      name: string;
      coordinates: { lat: number; lng: number };
    };
    destination?: {
      name: string;
      coordinates: { lat: number; lng: number };
    };
    waypoints: Array<{
      name: string;
      coordinates: { lat: number; lng: number };
    }>;
    status: "draft" | "ready" | "in_progress" | "completed";
  };
}
```

**Implementación**:
- Usar Memory de Mastra para almacenar estado de sesión
- Integrar con GeoFilter_Tool cuando se proporciona nombre de ubicación

---

### 4. Preference_Tool
**Propósito**: Gestión de preferencias de usuario y memoria a largo plazo

**Funcionalidad**:
- Recupera ubicaciones guardadas ("Casa", "Trabajo")
- Almacena preferencias de ruta ("Evitar autopistas")
- Accede a historial de viajes

**Input Schema**:
```typescript
{
  action: "get_saved_locations" | "save_location" | 
          "get_preferences" | "update_preferences" | 
          "get_trip_history";
  locationName?: string;        // "Casa", "Trabajo"
  location?: {
    name: string;
    coordinates: { lat: number; lng: number };
  };
  preferences?: {
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    preferredVehicleType?: "economy" | "comfort" | "premium";
  };
}
```

**Output Schema**:
```typescript
{
  savedLocations?: Array<{
    name: string;
    coordinates: { lat: number; lng: number };
    lastUsed?: string;          // ISO date
  }>;
  preferences?: {
    avoidTolls: boolean;
    avoidHighways: boolean;
    preferredVehicleType: string;
  };
  tripHistory?: Array<{
    origin: string;
    destination: string;
    date: string;
    price: number;
  }>;
}
```

**Implementación**:
- Usar Memory de Mastra con almacenamiento persistente (LibSQLStore)
- Separar memoria de sesión (corto plazo) de preferencias (largo plazo)

---

### 5. RouteCalculator_Tool
**Propósito**: Cálculo de ruta, distancia, tiempo y precio

**Funcionalidad**:
- Calcula ruta óptima entre origen y destino
- Estima tiempo de llegada (ETA)
- Calcula precio estimado
- Considera preferencias de usuario

**Input Schema**:
```typescript
{
  origin: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
  };
  waypoints?: Array<{
    latitude: number;
    longitude: number;
  }>;
  preferences?: {
    avoidTolls?: boolean;
    avoidHighways?: boolean;
  };
  vehicleType?: "economy" | "comfort" | "premium";
}
```

**Output Schema**:
```typescript
{
  route: {
    distance: number;            // metros
    duration: number;            // segundos
    polyline?: string;           // Para visualización en mapa
  };
  pricing: {
    estimatedPrice: number;      // en moneda local
    currency: string;
    breakdown: {
      baseFare: number;
      distanceFare: number;
      timeFare: number;
      surgeMultiplier?: number;
    };
  };
  eta: {
    estimatedArrival: string;    // ISO datetime
    estimatedDuration: string;   // "15 minutos"
  };
}
```

**Implementación**:
- Usar Google Maps Directions API o similar
- Implementar lógica de pricing determinística
- Considerar tarifas dinámicas (surge pricing)

---

### 6. HumanInLoop_Tool
**Propósito**: Desambiguación y confirmación con el usuario

**Funcionalidad**:
- Detiene el flujo cuando hay incertidumbre
- Genera mensajes estructurados para aclaración
- Maneja múltiples opciones de ubicación

**Input Schema**:
```typescript
{
  type: "location_disambiguation" | "confirmation" | "clarification";
  question: string;
  options?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  context?: string;
}
```

**Output Schema**:
```typescript
{
  userResponse: string;
  selectedOptionId?: string;
  confirmed: boolean;
}
```

**Implementación**:
- Genera prompt estructurado para el usuario
- Espera respuesta del usuario (vía speech-to-speech o texto)
- Retorna selección para continuar el flujo

---

### 7. AuditLog_Tool
**Propósito**: Registro de eventos y observabilidad

**Funcionalidad**:
- Registra cada paso de la orquestación
- Almacena decisiones del LLM
- Permite auditoría y debugging

**Input Schema**:
```typescript
{
  event: "tool_call" | "user_input" | "agent_decision" | "error";
  toolName?: string;
  input?: any;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}
```

**Output Schema**:
```typescript
{
  logged: boolean;
  logId: string;
  timestamp: string;
}
```

**Implementación**:
- Integrar con observability de Mastra
- Almacenar en base de datos para análisis posterior
- Incluir contexto completo para debugging

---

## Agente Principal: MobilityAgent

### Configuración

```typescript
const mobilityAgent = new Agent({
  name: 'Mobility Agent',
  instructions: `
    You are a conversational mobility assistant for a ride-sharing application.
    
    Your primary responsibilities:
    1. Understand user's location requests (absolute or relative)
    2. Manage trip state (origin, destination, waypoints)
    3. Calculate routes and pricing
    4. Handle disambiguation when needed
    5. Remember user preferences and saved locations
    
    Key behaviors:
    - Always confirm critical information (origin, destination) before calculating routes
    - Use GeoFilter_Tool for location searches, prioritizing context (country, city)
    - Use MicroAdjust_Tool for relative movements ("10 meters right", "two streets ahead")
    - Use HumanInLoop_Tool when multiple location candidates are found
    - Store trip state using TripState_Tool
    - Retrieve user preferences using Preference_Tool
    - Calculate routes only when both origin and destination are set
    
    Response style:
    - Be conversational and natural
    - Confirm understanding before taking actions
    - Provide clear options when disambiguating
    - Use saved locations when user mentions "home", "work", etc.
  `,
  model: 'google/gemini-2.5-pro', // o 'openai/gpt-4o'
  tools: {
    geoFilter: geoFilterTool,
    microAdjust: microAdjustTool,
    tripState: tripStateTool,
    preference: preferenceTool,
    routeCalculator: routeCalculatorTool,
    humanInLoop: humanInLoopTool,
    auditLog: auditLogTool,
  },
  voice: new OpenAIRealtimeVoice({
    model: 'gpt-4o-mini-realtime',
    speaker: 'alloy',
  }),
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});
```

### Flujo de Conversación Típico

1. **Usuario**: "Necesito un viaje desde mi casa hasta el aeropuerto"
   - Agent usa `Preference_Tool` para obtener "Casa" guardada
   - Agent usa `GeoFilter_Tool` para buscar "aeropuerto" con contexto
   - Si múltiples aeropuertos → `HumanInLoop_Tool`
   - Agent usa `TripState_Tool` para establecer origen y destino
   - Agent usa `RouteCalculator_Tool` para calcular ruta y precio
   - Agent responde con confirmación y detalles

2. **Usuario**: "Mueve el pin 10 metros a la derecha"
   - Agent identifica que hay un pin activo (del estado de viaje)
   - Agent usa `MicroAdjust_Tool` con punto de anclaje y dirección
   - Agent actualiza estado con `TripState_Tool`
   - Agent recalcula ruta si es necesario

3. **Usuario**: "Cambia mi destino al restaurante X"
   - Agent usa `GeoFilter_Tool` para buscar "restaurante X"
   - Agent usa `TripState_Tool` para actualizar destino
   - Agent recalcula ruta y precio

---

## Integración Speech-to-Speech

### Configuración

```typescript
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { getMicrophoneStream, playAudio } from '@mastra/node-audio';

// El voice se configura en el Agent (ver arriba)

// Para iniciar conversación:
await mobilityAgent.voice.connect();

// Escuchar respuestas del agente
mobilityAgent.voice.on('speaker', ({ audio }) => {
  playAudio(audio);
});

// Escuchar eventos de escritura (opcional)
mobilityAgent.voice.on('writing', ({ role, text }) => {
  console.log(`${role}: ${text}`);
});

// Iniciar conversación
await mobilityAgent.voice.speak("¡Hola! ¿A dónde te gustaría ir hoy?");

// Enviar audio del micrófono
const micStream = getMicrophoneStream();
await mobilityAgent.voice.send(micStream);
```

### Eventos Importantes

- `speaker`: Audio del agente (reproducir)
- `writing`: Texto que el agente está generando (para UI)
- `turnComplete`: Turno completado
- `error`: Errores de conexión

---

## Memoria y Estado

### Memoria de Sesión (Corto Plazo)
- Estado actual del viaje (origen, destino, waypoints)
- Contexto de la conversación actual
- Ubicaciones mencionadas en la sesión

### Memoria a Largo Plazo
- Ubicaciones guardadas del usuario
- Preferencias de viaje
- Historial de viajes
- Patrones de uso

### Implementación con Mastra Memory

```typescript
// En el Agent
memory: new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
}),

// Uso en tools
const sessionData = await agent.memory.get('trip_state');
await agent.memory.set('trip_state', newTripState);
```

---

## Observabilidad y Logging

### Integración con Mastra Observability

```typescript
export const mastra = new Mastra({
  agents: { mobilityAgent },
  observability: {
    default: { enabled: true },
  },
  logger: new PinoLogger({
    name: 'MobilityAgent',
    level: 'info',
  }),
});
```

### Eventos a Registrar

1. **Tool Calls**: Cada llamada a herramienta con input/output
2. **User Inputs**: Todas las entradas del usuario
3. **Agent Decisions**: Decisiones del LLM (qué tool usar, parámetros)
4. **Errors**: Errores de APIs, cálculos, etc.
5. **Disambiguations**: Cuándo se requiere input humano

---

## Dependencias Necesarias

```json
{
  "@mastra/core": "^0.24.0",
  "@mastra/memory": "^0.15.11",
  "@mastra/libsql": "^0.16.2",
  "@mastra/loggers": "^0.10.19",
  "@mastra/voice-openai-realtime": "^latest",
  "@mastra/node-audio": "^latest",
  "zod": "^4.1.12"
}
```

### APIs Externas

1. **Google Maps API** (o alternativa):
   - Geocoding API
   - Directions API
   - Places API (opcional)

2. **OpenAI API**:
   - Para speech-to-speech (Realtime API)

---

## Fases de Implementación

### Fase 1: Herramientas Base (Semana 1)
- [ ] GeoFilter_Tool
- [ ] TripState_Tool
- [ ] RouteCalculator_Tool
- [ ] Configuración básica del agente

### Fase 2: Herramientas Avanzadas (Semana 2)
- [ ] MicroAdjust_Tool
- [ ] Preference_Tool
- [ ] HumanInLoop_Tool
- [ ] AuditLog_Tool

### Fase 3: Integración de Voz (Semana 3)
- [ ] Configuración Speech-to-Speech
- [ ] Pruebas de flujo conversacional
- [ ] Manejo de eventos de voz

### Fase 4: Optimización y Producción (Semana 4)
- [ ] Optimización de prompts
- [ ] Manejo de errores robusto
- [ ] Testing end-to-end
- [ ] Documentación

---

## Consideraciones de Seguridad y Privacidad

1. **Datos Sensibles**: No almacenar información de pago en memoria
2. **Geolocalización**: Obtener consentimiento explícito
3. **Logging**: Anonimizar datos personales en logs
4. **APIs**: Usar variables de entorno para API keys

---

## Métricas de Éxito

1. **Precisión de Ubicación**: >95% de ubicaciones correctamente identificadas
2. **Tiempo de Respuesta**: <2 segundos para cálculos de ruta
3. **Tasa de Desambiguación**: <10% de interacciones requieren aclaración
4. **Satisfacción del Usuario**: Medir con feedback cualitativo

---

## Próximos Pasos

1. Revisar y aprobar este plan
2. Configurar APIs externas (Google Maps, OpenAI)
3. Crear estructura de proyecto
4. Implementar herramientas en orden de prioridad
5. Integrar con agente principal
6. Pruebas iterativas

