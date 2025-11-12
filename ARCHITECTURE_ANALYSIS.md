# Análisis de Arquitectura: Migración a Sistema de Subagentes

## 📋 Resumen Ejecutivo

Este documento analiza la arquitectura actual del proyecto **yavoy-agent** y propone una migración a un sistema de **orquestador con subagentes**. El objetivo es separar responsabilidades en tres subagentes especializados: `mobility-agent`, `customer-service-agent`, y `driver-service-agent`, coordinados por un orquestador principal.

---

## 🏗️ Arquitectura Actual

### Estructura Actual

```
MobilityAgent (Agente Único)
├── Model: google/gemini-2.5-flash-lite
├── Voice: GeminiLiveVoice (opcional)
├── Memory: LibSQLStore + LibSQLVector
└── Tools (7 herramientas):
    ├── googleMapsGroundingTool
    ├── microAdjustTool
    ├── tripStateTool
    ├── preferenceTool
    ├── routeCalculatorTool
    ├── humanInLoopTool
    └── auditLogTool
```

### Componentes Actuales

#### 1. **MobilityAgent** (`src/mastra/agents/mobility-agent.ts`)
- **Responsabilidades actuales:**
  - Gestión completa de viajes (origen, destino, waypoints)
  - Búsqueda de ubicaciones con Google Maps Grounding
  - Cálculo de rutas y precios
  - Gestión de preferencias de usuario
  - Desambiguación de ubicaciones
  - Interacción con clientes y conductores (sin diferenciación)

- **Características:**
  - Modelo: `google/gemini-2.5-flash-lite`
  - Voice: GeminiLiveVoice (condicional)
  - Memory: Con semantic recall y vector store
  - Instrucciones: ~120 líneas de prompt detallado

#### 2. **Herramientas (Tools)**

| Herramienta | Propósito | Complejidad | Reutilizable |
|------------|-----------|-------------|--------------|
| `googleMapsGroundingTool` | Búsqueda de ubicaciones | Alta | ✅ Sí |
| `microAdjustTool` | Ajustes relativos de ubicación | Media | ✅ Sí |
| `tripStateTool` | Estado de viaje | Media | ⚠️ Parcial |
| `preferenceTool` | Preferencias usuario | Baja | ✅ Sí |
| `routeCalculatorTool` | Cálculo de rutas/precios | Alta | ✅ Sí |
| `humanInLoopTool` | Desambiguación | Baja | ✅ Sí |
| `auditLogTool` | Logging | Baja | ✅ Sí |

#### 3. **Almacenamiento**
- **Session Storage** (`session-storage.ts`): In-memory, thread-scoped
- **LibSQLStore**: Persistencia de memoria del agente
- **LibSQLVector**: Vector store para semantic recall

### Flujo Actual de Conversación

```
Usuario → MobilityAgent → [Herramientas] → Respuesta
```

**Ejemplo:**
1. Usuario: "Necesito un viaje desde mi casa hasta el aeropuerto"
2. Agent usa `preferenceTool` → obtiene "casa"
3. Agent usa `googleMapsGroundingTool` → busca "aeropuerto"
4. Agent usa `tripStateTool` → establece origen/destino
5. Agent usa `routeCalculatorTool` → calcula ruta/precio
6. Agent responde con detalles del viaje

### Limitaciones de la Arquitectura Actual

1. **Falta de Especialización:**
   - El mismo agente maneja tanto clientes como conductores
   - No hay diferenciación en respuestas según tipo de usuario
   - Instrucciones genéricas que intentan cubrir todos los casos

2. **Escalabilidad:**
   - Un solo agente con muchas responsabilidades
   - Difícil agregar nuevas funcionalidades sin afectar el agente principal
   - Prompts largos y complejos

3. **Mantenibilidad:**
   - Cambios en un área pueden afectar otras
   - Testing más complejo
   - Debugging más difícil

4. **Experiencia de Usuario:**
   - No hay personalización según rol (cliente vs conductor)
   - Respuestas genéricas que no aprovechan el contexto del rol

---

## 🎯 Arquitectura Propuesta: Sistema de Subagentes

### Visión General

```
┌─────────────────────────────────────────────────────────┐
│              Orchestrator Agent (Orquestador)            │
│  - Identifica intención y tipo de usuario                │
│  - Enruta a subagente apropiado                          │
│  - Coordina entre subagentes si es necesario             │
│  - Gestiona contexto compartido                          │
└──────────────┬───────────────────────────────────────────┘
               │
       ┌───────┴───────┬───────────────┐
       │               │               │
┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│ Mobility    │ │ Customer    │ │ Driver      │
│ Agent       │ │ Service     │ │ Service     │
│             │ │ Agent       │ │ Agent       │
│ - Viajes    │ │ - Precios   │ │ - Preguntas │
│ - Rutas     │ │ - Info      │ │ básicas     │
│ - Estado    │ │ básica      │ │ - Ayuda     │
└─────────────┘ └─────────────┘ └─────────────┘
```

### Componentes Propuestos

#### 1. **Orchestrator Agent** (Nuevo)

**Responsabilidades:**
- **Routing inteligente**: Identificar si el usuario es cliente o conductor
- **Detección de intención**: Determinar qué subagente debe manejar la solicitud
- **Gestión de contexto**: Mantener contexto compartido entre subagentes
- **Coordinación**: Manejar casos que requieren múltiples subagentes
- **Fallback**: Manejar casos no cubiertos por subagentes

**Herramientas necesarias:**
- `routeToSubagentTool`: Enrutar a subagente específico
- `userTypeDetectionTool`: Detectar tipo de usuario (cliente/conductor)
- `contextManagerTool`: Gestionar contexto compartido

**Instrucciones propuestas:**
```
Eres el orquestador principal de un sistema de movilidad tipo Uber.
Tu función es identificar el tipo de usuario (cliente o conductor) y 
enrutar las solicitudes al subagente apropiado.

Subagentes disponibles:
1. mobility-agent: Para gestión de viajes, rutas, ubicaciones
2. customer-service-agent: Para preguntas básicas de clientes (precios, info)
3. driver-service-agent: Para preguntas básicas de conductores

Reglas:
- Si el usuario pregunta sobre precios, tarifas, o información general → customer-service-agent
- Si el usuario es conductor y pregunta sobre su trabajo → driver-service-agent
- Si el usuario quiere gestionar un viaje → mobility-agent
- Si no estás seguro, pregunta al usuario o usa mobility-agent como default
```

#### 2. **Mobility Agent** (Refactorizado)

**Responsabilidades:**
- Gestión completa de viajes (origen, destino, waypoints)
- Búsqueda de ubicaciones
- Cálculo de rutas y precios
- Gestión de estado de viaje
- Ajustes de ubicación

**Herramientas (mantener):**
- `googleMapsGroundingTool` ✅
- `microAdjustTool` ✅
- `tripStateTool` ✅
- `preferenceTool` ✅
- `routeCalculatorTool` ✅
- `humanInLoopTool` ✅
- `auditLogTool` ✅

**Cambios necesarios:**
- Simplificar instrucciones (remover referencias a preguntas básicas)
- Enfocarse solo en gestión de viajes
- Mantener todas las herramientas actuales

#### 3. **Customer Service Agent** (Nuevo)

**Responsabilidades:**
- Responder preguntas básicas de clientes
- Información sobre precios y tarifas
- Información general sobre el servicio
- FAQ básico
- Ayuda con problemas comunes

**Herramientas necesarias:**
- `pricingInfoTool`: Obtener información de precios (puede usar `routeCalculatorTool` internamente)
- `faqTool`: Base de conocimiento de preguntas frecuentes
- `serviceInfoTool`: Información general del servicio
- `auditLogTool`: Para logging

**Instrucciones propuestas:**
```
Eres un asistente de servicio al cliente para una aplicación de movilidad tipo Uber.
Tu función es responder preguntas básicas de los clientes sobre:
- Precios y tarifas de viajes
- Información general del servicio
- Preguntas frecuentes
- Problemas comunes

Mantén respuestas claras, concisas y amigables.
Si la pregunta requiere gestión de un viaje específico, informa al usuario
que debe usar la funcionalidad de reserva de viajes.
```

**Ejemplos de preguntas que manejaría:**
- "¿Cuánto cuesta un viaje?"
- "¿Cómo funciona el servicio?"
- "¿Qué métodos de pago aceptan?"
- "¿Puedo cancelar un viaje?"
- "¿Cuánto tiempo tarda un conductor en llegar?"

#### 4. **Driver Service Agent** (Nuevo)

**Responsabilidades:**
- Responder preguntas básicas de conductores
- Información sobre pagos y comisiones
- Información sobre requisitos y políticas
- Ayuda con problemas comunes de conductores
- FAQ para conductores

**Herramientas necesarias:**
- `driverInfoTool`: Información específica para conductores
- `paymentInfoTool`: Información sobre pagos y comisiones
- `policyTool`: Políticas y requisitos
- `faqTool`: FAQ específico para conductores
- `auditLogTool`: Para logging

**Instrucciones propuestas:**
```
Eres un asistente de servicio para conductores de una aplicación de movilidad tipo Uber.
Tu función es responder preguntas básicas de los conductores sobre:
- Pagos y comisiones
- Requisitos y políticas
- Cómo usar la aplicación como conductor
- Problemas comunes

Mantén respuestas claras, concisas y profesionales.
Si la pregunta requiere gestión de un viaje activo, informa al conductor
que debe usar la funcionalidad de gestión de viajes.
```

**Ejemplos de preguntas que manejaría:**
- "¿Cuánto es mi comisión?"
- "¿Cómo recibo mis pagos?"
- "¿Qué requisitos necesito para ser conductor?"
- "¿Puedo cancelar un viaje?"
- "¿Cómo reporto un problema con un pasajero?"

---

## 📊 Análisis de Componentes

### Herramientas: Reutilización y Distribución

#### Herramientas Compartidas (Todos los Agentes)

| Herramienta | Orchestrator | Mobility | Customer | Driver | Notas |
|------------|--------------|----------|----------|--------|-------|
| `auditLogTool` | ✅ | ✅ | ✅ | ✅ | Logging universal |
| `humanInLoopTool` | ✅ | ✅ | ✅ | ✅ | Desambiguación universal |

#### Herramientas Específicas de Mobility Agent

| Herramienta | Uso | Mantener |
|------------|-----|----------|
| `googleMapsGroundingTool` | Búsqueda de ubicaciones | ✅ Sí |
| `microAdjustTool` | Ajustes relativos | ✅ Sí |
| `tripStateTool` | Estado de viaje | ✅ Sí |
| `preferenceTool` | Preferencias usuario | ✅ Sí |
| `routeCalculatorTool` | Cálculo rutas/precios | ✅ Sí |

#### Nuevas Herramientas Necesarias

**Para Orchestrator:**
- `routeToSubagentTool`: Enrutar a subagente
- `userTypeDetectionTool`: Detectar tipo de usuario
- `contextManagerTool`: Gestionar contexto compartido

**Para Customer Service Agent:**
- `pricingInfoTool`: Información de precios (puede usar `routeCalculatorTool` internamente)
- `faqTool`: Base de conocimiento FAQ
- `serviceInfoTool`: Información general del servicio

**Para Driver Service Agent:**
- `driverInfoTool`: Información para conductores
- `paymentInfoTool`: Pagos y comisiones
- `policyTool`: Políticas y requisitos
- `faqTool`: FAQ para conductores

### Almacenamiento y Memoria

#### Memoria Compartida vs. Específica

**Opción A: Memoria Compartida (Recomendada)**
- Un solo `LibSQLStore` compartido
- Contexto compartido entre todos los agentes
- Preferencias de usuario accesibles por todos
- Estado de viaje accesible por todos

**Opción B: Memoria Separada**
- Cada agente tiene su propia memoria
- Necesita sincronización entre agentes
- Más complejo pero más aislado

**Recomendación: Opción A** con namespaces/claves específicas:
```typescript
// Ejemplo de estructura de memoria
{
  "user_preferences": {...},      // Compartido
  "trip_state": {...},             // Mobility Agent
  "customer_faq_cache": {...},     // Customer Service Agent
  "driver_info_cache": {...},      // Driver Service Agent
}
```

### Gestión de Contexto

**Contexto Compartido:**
- Tipo de usuario (cliente/conductor)
- ID de usuario
- Preferencias de usuario
- Estado de sesión

**Contexto Específico:**
- Estado de viaje (Mobility Agent)
- Historial de preguntas (Customer/Driver Service Agents)
- Cache de información (Customer/Driver Service Agents)

---

## 🔄 Flujos de Conversación Propuestos

### Flujo 1: Cliente pregunta sobre precios

```
Usuario: "¿Cuánto cuesta un viaje?"
  ↓
Orchestrator Agent
  ├─ Detecta: Pregunta básica de cliente
  ├─ Enruta a: Customer Service Agent
  └─ Pasa contexto: { userType: 'customer', question: 'pricing' }
  ↓
Customer Service Agent
  ├─ Usa: pricingInfoTool
  ├─ Obtiene: Información de precios
  └─ Responde: "Los viajes tienen una tarifa base de $2.50..."
  ↓
Orchestrator Agent
  └─ Retorna respuesta al usuario
```

### Flujo 2: Cliente quiere reservar un viaje

```
Usuario: "Necesito un viaje desde mi casa hasta el aeropuerto"
  ↓
Orchestrator Agent
  ├─ Detecta: Gestión de viaje
  ├─ Enruta a: Mobility Agent
  └─ Pasa contexto: { userType: 'customer', intent: 'book_trip' }
  ↓
Mobility Agent
  ├─ Usa: preferenceTool → obtiene "casa"
  ├─ Usa: googleMapsGroundingTool → busca "aeropuerto"
  ├─ Usa: tripStateTool → establece origen/destino
  ├─ Usa: routeCalculatorTool → calcula ruta/precio
  └─ Responde: Detalles del viaje
  ↓
Orchestrator Agent
  └─ Retorna respuesta al usuario
```

### Flujo 3: Conductor pregunta sobre comisiones

```
Usuario (Conductor): "¿Cuánto es mi comisión?"
  ↓
Orchestrator Agent
  ├─ Detecta: Pregunta básica de conductor
  ├─ Enruta a: Driver Service Agent
  └─ Pasa contexto: { userType: 'driver', question: 'commission' }
  ↓
Driver Service Agent
  ├─ Usa: paymentInfoTool
  ├─ Obtiene: Información de comisiones
  └─ Responde: "Tu comisión es del 25%..."
  ↓
Orchestrator Agent
  └─ Retorna respuesta al usuario
```

### Flujo 4: Caso complejo (requiere múltiples agentes)

```
Usuario: "Quiero un viaje al aeropuerto, ¿cuánto cuesta?"
  ↓
Orchestrator Agent
  ├─ Detecta: Múltiples intenciones (reservar + pregunta de precio)
  ├─ Estrategia: Primero obtener precio, luego gestionar viaje
  ├─ Enruta a: Customer Service Agent (pregunta de precio)
  └─ Luego enruta a: Mobility Agent (gestión de viaje)
  ↓
Customer Service Agent → Responde sobre precios
Mobility Agent → Gestiona el viaje
  ↓
Orchestrator Agent
  └─ Combina respuestas y retorna al usuario
```

---

## 🎨 Consideraciones de Diseño

### 1. **Detección de Tipo de Usuario**

**Opciones:**

**A. Explícita (Recomendada):**
- El sistema identifica al usuario al inicio de sesión
- Se pasa `userType` en el contexto
- Orchestrator usa esta información para routing

**B. Implícita:**
- Orchestrator analiza el mensaje para inferir tipo de usuario
- Basado en palabras clave y contexto
- Menos confiable pero más flexible

**C. Híbrida:**
- Usa información explícita si está disponible
- Fallback a detección implícita si no está disponible

**Recomendación: Opción A (Explícita)** con fallback a C (Híbrida)

### 2. **Gestión de Estado Compartido**

**Problema:** ¿Cómo comparten estado los agentes?

**Solución propuesta:**
- Usar `Memory` de Mastra con claves namespaced
- Orchestrator gestiona el contexto compartido
- Cada agente lee/escribe en su namespace
- Orchestrator sincroniza cuando es necesario

**Ejemplo:**
```typescript
// En Orchestrator
await memory.set('shared:userType', 'customer');
await memory.set('shared:userId', 'user-123');

// En Mobility Agent
const userType = await memory.get('shared:userType');
const tripState = await memory.get('mobility:tripState');
```

### 3. **Comunicación entre Agentes**

**Opciones:**

**A. A través del Orchestrator (Recomendada):**
- Los agentes no se comunican directamente
- Orchestrator actúa como intermediario
- Más control y trazabilidad

**B. Directa:**
- Los agentes pueden llamarse entre sí
- Más flexible pero más complejo
- Riesgo de dependencias circulares

**Recomendación: Opción A**

### 4. **Manejo de Errores y Fallbacks**

**Estrategia:**
- Si un subagente falla, Orchestrator intenta otro
- Si no hay subagente apropiado, Orchestrator maneja directamente
- Logging de todos los errores con `auditLogTool`

### 5. **Performance y Costos**

**Consideraciones:**
- Cada agente tiene su propio modelo (costos)
- Orchestrator agrega una capa adicional (latencia)
- Balancear especialización vs. costo

**Optimizaciones:**
- Usar modelos más pequeños para Customer/Driver Service Agents
- Cache de respuestas frecuentes
- Lazy loading de agentes

---

## 📁 Estructura de Archivos Propuesta

```
src/mastra/
├── agents/
│   ├── orchestrator-agent.ts        # NUEVO: Orquestador principal
│   ├── mobility-agent.ts            # REFACTORIZADO: Gestión de viajes
│   ├── customer-service-agent.ts    # NUEVO: Servicio al cliente
│   └── driver-service-agent.ts      # NUEVO: Servicio a conductores
├── tools/
│   ├── orchestrator/
│   │   ├── route-to-subagent-tool.ts      # NUEVO
│   │   ├── user-type-detection-tool.ts    # NUEVO
│   │   └── context-manager-tool.ts         # NUEVO
│   ├── customer-service/
│   │   ├── pricing-info-tool.ts           # NUEVO
│   │   ├── faq-tool.ts                    # NUEVO
│   │   └── service-info-tool.ts           # NUEVO
│   ├── driver-service/
│   │   ├── driver-info-tool.ts            # NUEVO
│   │   ├── payment-info-tool.ts           # NUEVO
│   │   ├── policy-tool.ts                 # NUEVO
│   │   └── faq-tool.ts                    # NUEVO (específico para conductores)
│   └── [herramientas existentes se mantienen]
├── storage/
│   └── session-storage.ts            # Mantener, posiblemente extender
├── utils/
│   └── [utilidades existentes]
└── index.ts                          # Actualizar para registrar todos los agentes
```

---

## 🔧 Cambios Técnicos Necesarios

### 1. **Actualización de `mastra/index.ts`**

**Actual:**
```typescript
export const mastra = new Mastra({
  agents: { mobilityAgent },
  // ...
});
```

**Propuesto:**
```typescript
export const mastra = new Mastra({
  agents: {
    orchestratorAgent,
    mobilityAgent,
    customerServiceAgent,
    driverServiceAgent,
  },
  // ...
});
```

### 2. **Nuevas Dependencias**

No se requieren nuevas dependencias externas. Todo se puede implementar con:
- `@mastra/core` (ya instalado)
- `@mastra/memory` (ya instalado)
- `@mastra/libsql` (ya instalado)
- `zod` (ya instalado)

### 3. **Configuración de Modelos**

**Recomendación de modelos:**
- **Orchestrator**: `google/gemini-2.5-flash-lite` (rápido, económico)
- **Mobility Agent**: `google/gemini-2.5-flash-lite` (mantener actual)
- **Customer Service Agent**: `google/gemini-2.5-flash-lite` (suficiente para FAQ)
- **Driver Service Agent**: `google/gemini-2.5-flash-lite` (suficiente para FAQ)

**Alternativa (optimización de costos):**
- **Orchestrator**: `google/gemini-2.5-flash-lite`
- **Mobility Agent**: `google/gemini-2.5-flash-lite`
- **Customer/Driver Service Agents**: Modelos más pequeños si están disponibles

### 4. **Memory Compartida**

**Configuración propuesta:**
```typescript
// Todos los agentes comparten la misma instancia de Memory
const sharedMemory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
  vector: new LibSQLVector({
    connectionUrl: 'file:../mastra.db',
  }),
  embedder: 'google/text-embedding-004',
});

// Cada agente usa la misma instancia
orchestratorAgent.memory = sharedMemory;
mobilityAgent.memory = sharedMemory;
customerServiceAgent.memory = sharedMemory;
driverServiceAgent.memory = sharedMemory;
```

---

## ⚠️ Desafíos y Riesgos

### 1. **Complejidad Aumentada**
- **Riesgo**: Sistema más complejo = más difícil de mantener
- **Mitigación**: Documentación clara, tests exhaustivos, arquitectura bien definida

### 2. **Latencia Adicional**
- **Riesgo**: Orchestrator agrega una capa de latencia
- **Mitigación**: Usar modelos rápidos, cache de decisiones de routing

### 3. **Costo de Modelos**
- **Riesgo**: Múltiples agentes = múltiples llamadas a modelos
- **Mitigación**: Usar modelos pequeños para agentes simples, cache de respuestas

### 4. **Gestión de Contexto**
- **Riesgo**: Pérdida de contexto entre agentes
- **Mitigación**: Memory compartida, contexto explícito en routing

### 5. **Testing Complejo**
- **Riesgo**: Más componentes = más casos de prueba
- **Mitigación**: Tests unitarios por agente, tests de integración end-to-end

---

## 📈 Beneficios Esperados

### 1. **Especialización**
- Cada agente se enfoca en su dominio específico
- Prompts más cortos y específicos
- Mejor calidad de respuestas

### 2. **Escalabilidad**
- Fácil agregar nuevos subagentes
- Fácil modificar un subagente sin afectar otros
- Mejor separación de responsabilidades

### 3. **Mantenibilidad**
- Código más organizado y modular
- Fácil debugging (saber qué agente maneja qué)
- Tests más fáciles de escribir

### 4. **Experiencia de Usuario**
- Respuestas más personalizadas según rol
- Mejor manejo de casos específicos
- Menos confusión en respuestas

### 5. **Flexibilidad**
- Fácil deshabilitar/habilitar agentes
- Fácil cambiar modelos por agente
- Fácil agregar nuevas funcionalidades

---

## 🚀 Plan de Migración Sugerido (Solo Análisis)

### Fase 1: Preparación
1. Crear estructura de carpetas para nuevos agentes y herramientas
2. Documentar APIs y contratos entre agentes
3. Definir esquemas de memoria compartida

### Fase 2: Implementación del Orchestrator
1. Crear `orchestrator-agent.ts`
2. Implementar herramientas de routing
3. Tests del orchestrator

### Fase 3: Refactorización de Mobility Agent
1. Simplificar instrucciones
2. Asegurar compatibilidad con orchestrator
3. Tests de regresión

### Fase 4: Implementación de Customer Service Agent
1. Crear `customer-service-agent.ts`
2. Implementar herramientas de FAQ/precios
3. Tests del agente

### Fase 5: Implementación de Driver Service Agent
1. Crear `driver-service-agent.ts`
2. Implementar herramientas de información para conductores
3. Tests del agente

### Fase 6: Integración y Testing
1. Integrar todos los agentes
2. Tests end-to-end
3. Optimización de performance

### Fase 7: Documentación y Despliegue
1. Actualizar documentación
2. Guías de uso
3. Despliegue gradual

---

## 📝 Notas Finales

### Puntos Clave
1. **Orchestrator es crítico**: Debe ser robusto y bien diseñado
2. **Memory compartida**: Esencial para mantener contexto
3. **Herramientas reutilizables**: Maximizar reutilización donde sea posible
4. **Testing exhaustivo**: Especialmente en la integración entre agentes
5. **Documentación clara**: Especialmente para el routing y la comunicación entre agentes

### Decisiones Pendientes
1. ¿Cómo se identifica el tipo de usuario? (explícito vs. implícito)
2. ¿Qué modelo usar para cada agente?
3. ¿Cómo manejar casos que requieren múltiples agentes?
4. ¿Cómo implementar cache de respuestas?
5. ¿Cómo manejar versionado de agentes?

---

**Estado**: Análisis completado. Listo para revisión y aprobación antes de implementación.

