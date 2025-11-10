# YaVoy Agent - Agente Conversacional de Movilidad

Agente conversacional tipo Uber completamente impulsado por IA, construido con **Mastra**. Permite interacciones naturales en lenguaje para gestionar viajes, ubicaciones y preferencias.

## 🎯 Características

- **Interacción Natural**: Comandos complejos en lenguaje natural
- **Google Maps Grounding**: Búsqueda precisa de ubicaciones usando capacidades nativas de Gemini
- **Ajustes Relativos**: Movimientos relativos ("10 metros a la derecha", "dos calles al frente")
- **Gestión de Estado**: Manejo de origen, destino y waypoints
- **Preferencias de Usuario**: Ubicaciones guardadas y preferencias de ruta
- **Google Maps Directions**: Cálculo preciso de rutas, distancia, tiempo y precio
- **Gemini Live**: Speech-to-speech en tiempo real
- **Desambiguación**: Confirmación con usuario cuando hay incertidumbre
- **Observabilidad**: Logging completo de eventos y decisiones

## 🏗️ Arquitectura

El agente utiliza una arquitectura de **micro-agentes** especializados:

```
MobilityAgent (Orquestador)
├── GoogleMapsGrounding_Tool (Búsqueda de lugares)
├── DistanceMatrix_Tool (Estimación de precios por tipo de vehículo)
├── MicroAdjust_Tool (Ajustes relativos)
├── TripState_Tool (Estado de viaje)
├── Preference_Tool (Preferencias usuario)
├── RouteCalculator_Tool (Cálculo de rutas completo)
├── HumanInLoop_Tool (Desambiguación)
└── AuditLog_Tool (Observabilidad)
```

## 📦 Instalación

```bash
npm install
```

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```env
# API Key para Gemini (requerida)
GOOGLE_API_KEY=your_google_api_key

# API Key para Google Maps Directions API (recomendada)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**Obtener API Keys:**
- **Gemini API Key**: https://aistudio.google.com/app/apikey
- **Google Maps API Key**: https://console.cloud.google.com/google/maps-apis

**Nota**: 
- `GOOGLE_API_KEY` es **requerida** para Google Maps Grounding y Gemini Live
- `GOOGLE_MAPS_API_KEY` es **recomendada** para cálculo preciso de rutas. Si no está configurada, se usará cálculo estimado como fallback.

## 🚀 Uso Básico

### Ejemplo Simple

```typescript
import { mastra } from './src/mastra/index';

const agent = mastra.getAgent('mobilityAgent');

// Interactuar con el agente
// IMPORTANTE: Usa maxSteps para permitir múltiples iteraciones y completar el flujo automáticamente
const response = await agent.generate(
  'Necesito un viaje desde mi casa hasta el aeropuerto',
  {
    threadId: 'user-123-session-1',
    resourceId: 'user-123',
    maxSteps: 10, // Permite que el agente complete el flujo completo automáticamente
  }
);

console.log(response.text);
```

**Nota sobre `maxSteps`:**
- **Valor por defecto:** 1 (solo una iteración)
- **Recomendado:** 10 para flujos complejos que requieren múltiples herramientas
- El agente está configurado para completar automáticamente el flujo completo (búsqueda → estado → ruta) cuando tiene toda la información
- Con `maxSteps: 10`, el agente puede usar múltiples herramientas en secuencia sin requerir interacciones adicionales del usuario

### Ejemplo con Streaming

```typescript
const stream = await agent.stream(
  'Busca el restaurante más cercano',
  {
    threadId: 'user-123-session-1',
    resourceId: 'user-123',
    maxSteps: 10, // También funciona con streaming
  }
);

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## 🎤 Speech-to-Speech con Gemini Live

El agente ya está configurado con **Gemini Live** para interacción por voz en tiempo real.

**Uso básico:**
```typescript
import { mastra } from './src/mastra/index';
import { getMicrophoneStream, playAudio } from '@mastra/node-audio';

const agent = mastra.getAgent('mobilityAgent');

// Conectar a Gemini Live
await agent.voice.connect();

// Escuchar respuestas del agente
agent.voice.on('speaker', ({ audio }) => {
  playAudio(audio);
});

// Escuchar eventos de escritura (opcional)
agent.voice.on('writing', ({ role, text }) => {
  console.log(`${role}: ${text}`);
});

// Iniciar conversación
await agent.voice.speak('¡Hola! ¿A dónde te gustaría ir hoy?');

// Enviar audio del micrófono
const micStream = getMicrophoneStream();
await agent.voice.send(micStream);
```

**Nota**: Para usar speech-to-speech, necesitas instalar `@mastra/node-audio` (requiere compilación nativa, puede necesitar Visual Studio en Windows).

## 📝 Ejemplos de Comandos

### Comportamiento Inteligente del Agente

El agente es inteligente sobre cuándo buscar automáticamente y cuándo preguntar:

**Busca automáticamente** cuando el usuario proporciona lugares específicos:
- "Aeropuerto Internacional"
- "Plaza Bolívar"
- "Restaurante El Jardín"
- "Centro Comercial Sambil"

**Pregunta por ubicación exacta** cuando el usuario proporciona solo nombres de ciudades (muy ambiguos):
- "Caracas" → Pregunta: "¿A qué lugar exacto en Caracas quieres ir?"
- "San Juan de los Morros" → Pregunta: "¿Cuál es la dirección exacta en San Juan de los Morros?"

### Búsqueda de Ubicación (usando Google Maps Grounding)
```
Usuario: "Busca el aeropuerto más cercano"
Usuario: "Encuentra restaurantes cerca de aquí"
Usuario: "Dónde está el centro comercial más grande"
```

### Gestión de Viaje
```
Usuario: "Quiero ir desde mi casa hasta el centro comercial"
Usuario: "Cambia mi destino al restaurante X"
Usuario: "Agrega una parada en la farmacia"
```

**Nota sobre el flujo de precios:**
- Cuando el agente tiene origen y destino con coordenadas exactas:
  1. Primero usa Distance Matrix API para obtener distancia, tiempo y precios estimados para TODOS los tipos de vehículos (moto, economy, comfort, premium, xl)
  2. Presenta las opciones de precio al usuario
  3. Pregunta: "¿Deseas proceder con el viaje? ¿Qué tipo de vehículo prefieres?"
  4. Espera la confirmación y selección del usuario
  5. Luego calcula la ruta completa con el tipo de vehículo seleccionado usando Directions API

### Ajustes Relativos
```
Usuario: "Mueve el pin 10 metros a la derecha"
Usuario: "Ajusta la ubicación dos calles al frente"
Usuario: "Muévelo un poco más a la izquierda"
```

### Preferencias
```
Usuario: "Guarda esta ubicación como 'Casa'"
Usuario: "Recuérdame que prefiero evitar peajes"
Usuario: "Muéstrame mis ubicaciones guardadas"
```

## 🛠️ Desarrollo

```bash
# Modo desarrollo
npm run dev

# Build
npm run build

# Iniciar
npm start
```

## 📚 Estructura del Proyecto

```
src/mastra/
├── agents/
│   └── mobility-agent.ts      # Agente principal con Gemini Live
├── tools/
│   ├── google-maps-grounding-tool.ts # Google Maps Grounding
│   ├── micro-adjust-tool.ts   # Ajustes relativos
│   ├── trip-state-tool.ts     # Estado de viaje
│   ├── preference-tool.ts      # Preferencias
│   ├── route-calculator-tool.ts # Google Maps Directions API
│   ├── human-in-loop-tool.ts  # Desambiguación
│   └── audit-log-tool.ts      # Logging
├── utils/
│   └── grounding-processor.ts # Procesamiento de grounding metadata
├── storage/
│   └── session-storage.ts      # Almacenamiento temporal
└── index.ts                   # Configuración Mastra
```

## 🔄 Migración desde Weather Agent

El proyecto originalmente tenía un agente de clima de ejemplo. Este ha sido reemplazado por el MobilityAgent. Los archivos del weather agent se mantienen en el repositorio pero no están registrados en `mastra/index.ts`.

## 📋 Próximos Pasos

- [x] Integrar Google Maps Grounding nativo de Gemini
- [x] Integrar Google Maps Directions API
- [x] Configurar Gemini Live para speech-to-speech
- [ ] Implementar almacenamiento persistente (base de datos)
- [ ] Agregar tests unitarios
- [ ] Mejorar manejo de errores
- [ ] Optimizar prompts del agente
- [ ] Agregar métricas y monitoreo
- [ ] Integrar Google Maps Places API para obtener coordenadas desde placeId

## 📖 Documentación

Ver `PLAN.md` para la arquitectura detallada y especificaciones completas.

## 🤝 Contribuir

Este es un proyecto de ejemplo. Siéntete libre de adaptarlo a tus necesidades.

## 📄 Licencia

ISC

