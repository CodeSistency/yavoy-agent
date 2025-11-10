# Plan de Mejoras del Agente MobilityAgent

## 📋 Resumen Ejecutivo

Este plan aborda tres problemas principales identificados en el agente:

1. **El agente pregunta al usuario en lugar de buscar coordenadas automáticamente**
2. **El agente no continúa automáticamente con el proceso completo** (requiere múltiples interacciones)
3. **Error ZERO_RESULTS en Google Maps Directions API** no se maneja adecuadamente

## 🎯 Objetivos

1. Hacer que el agente **siempre busque coordenadas automáticamente** cuando solo tiene nombres de ciudades/lugares
2. Configurar el agente para que **complete el flujo completo automáticamente** sin requerir múltiples interacciones del usuario
3. Mejorar el **manejo de errores** en el cálculo de rutas

---

## 🔍 Análisis de Problemas

### Problema 1: El agente pregunta en lugar de buscar automáticamente

**Situación actual:**
```
Usuario: "Quiero ir desde san juan de los morros hasta caracas"
Agente: "No puedo establecer el origen y el destino solo con los nombres de las ciudades. 
         Necesito las coordenadas o que me confirmes la dirección exacta."
```

**Causa raíz:**
- Las instrucciones del agente no son lo suficientemente explícitas sobre buscar coordenadas automáticamente
- El agente está siendo demasiado conservador y pidiendo confirmación

**Solución:**
- Modificar instrucciones para que el agente **SIEMPRE** use `googleMapsGrounding` cuando solo tiene nombres
- Eliminar la necesidad de confirmación para búsquedas de ubicaciones comunes

---

### Problema 2: El agente no continúa automáticamente

**Situación actual:**
```
Usuario: "Quiero ir desde san juan de los morros hasta caracas"
Agente: [Busca coordenadas] → [Establece estado] → [Se detiene]
Usuario: "ok, hazlo"
Agente: [Calcula ruta]
```

**Causa raíz:**
- Mastra tiene `maxSteps` por defecto en 1 (solo una iteración)
- El agente necesita múltiples pasos para completar el flujo completo
- Las instrucciones no enfatizan la necesidad de completar el flujo automáticamente

**Solución:**
- Mejorar instrucciones para que el agente entienda que debe completar el flujo completo
- Documentar que cuando se use el agente, se debe pasar `maxSteps: 10` o similar
- Hacer que el agente continúe automáticamente después de establecer origen/destino

---

### Problema 3: Error ZERO_RESULTS en Google Maps Directions API

**Situación actual:**
```
Error: "Google Maps Directions API error: ZERO_RESULTS - Unknown error"
```

**Causa raíz:**
- Las coordenadas pueden estar lejos de carreteras transitables
- No hay fallback cuando Google Maps no encuentra ruta
- El error no se maneja de manera útil para el usuario

**Solución:**
- Mejorar manejo de errores en `routeCalculatorTool`
- Implementar fallback a cálculo estimado cuando hay ZERO_RESULTS
- Proporcionar mensajes más útiles al usuario

---

## 📝 Plan de Implementación

### Fase 1: Mejorar Instrucciones del Agente

#### 1.1 Modificar Instrucciones para Búsqueda Automática

**Cambios en `mobility-agent.ts`:**

1. **Agregar sección explícita sobre búsqueda automática:**
   ```typescript
   ## Automatic Location Resolution:
   - ALWAYS use googleMapsGrounding tool when you only have location names (cities, places, addresses)
   - NEVER ask the user for coordinates if you have a location name - search automatically instead
   - When user provides city names like "San Juan de los Morros" or "Caracas", immediately search for coordinates
   - Only ask for clarification if multiple candidates are found and you cannot determine which one
   ```

2. **Modificar sección de Trip State Management:**
   ```typescript
   2. **Trip State Management**:
      - ALWAYS search for coordinates automatically when setting origin/destination with only names
      - Use googleMapsGrounding tool FIRST to get coordinates, THEN set trip state
      - After setting both origin and destination, AUTOMATICALLY proceed to calculate route
      - Do not wait for user confirmation - complete the full flow automatically
   ```

3. **Actualizar Example Flows:**
   ```typescript
   User: "Quiero ir desde san juan de los morros hasta caracas"
   1. IMMEDIATELY use googleMapsGrounding to search "san juan de los morros"
   2. IMMEDIATELY use googleMapsGrounding to search "caracas"
   3. Use tripState to set origin and destination with coordinates from grounding
   4. AUTOMATICALLY use routeCalculator to calculate route and price
   5. Present complete results to user
   
   DO NOT ask for confirmation between steps - complete the entire flow automatically.
   ```

#### 1.2 Enfatizar Continuidad Automática

**Agregar a instrucciones:**
```typescript
## Automatic Flow Completion:
- When user requests a trip, complete ALL steps automatically:
  1. Search for origin coordinates (if needed)
  2. Search for destination coordinates (if needed)
  3. Set trip state
  4. Calculate route
  5. Present results
- Do NOT stop and ask for confirmation between steps
- Only ask the user if there are multiple location candidates that need disambiguation
- After setting origin and destination, IMMEDIATELY calculate the route without waiting
```

---

### Fase 2: Mejorar Manejo de Errores en Route Calculator

#### 2.1 Mejorar Manejo de ZERO_RESULTS

**Cambios en `route-calculator-tool.ts`:**

1. **Detectar ZERO_RESULTS específicamente:**
   ```typescript
   if (routeData.status === 'ZERO_RESULTS') {
     // Intentar con cálculo estimado como fallback
     console.warn('[Route Calculator] ZERO_RESULTS from Google Maps, using estimated calculation');
     const routeData = estimateRoute(normalizedOrigin, normalizedDestination, normalizedWaypoints);
     // ... retornar resultado estimado con advertencia
   }
   ```

2. **Agregar mensaje informativo:**
   ```typescript
   return {
     route: { ... },
     pricing: { ... },
     eta: { ... },
     warning: 'Ruta calculada usando estimación. Google Maps no encontró una ruta directa entre las ubicaciones.',
   };
   ```

3. **Mejorar otros errores:**
   - Manejar `NOT_FOUND`, `OVER_QUERY_LIMIT`, etc.
   - Proporcionar mensajes más descriptivos

---

### Fase 3: Mejorar tripStateTool para Aceptar Nombres

#### 3.1 Hacer tripStateTool más Inteligente

**Opcional:** Modificar `tripStateTool` para que pueda aceptar solo nombres y buscar coordenadas internamente, pero esto puede ser complejo. 

**Alternativa preferida:** Mantener la separación de responsabilidades - el agente debe usar `googleMapsGrounding` primero, luego `tripState`.

---

### Fase 4: Documentar Uso de maxSteps

#### 4.1 Actualizar README

**Agregar a README.md:**
```markdown
### Configuración de maxSteps

Para que el agente complete flujos complejos automáticamente, usa `maxSteps`:

```typescript
const response = await agent.generate(
  'Quiero ir desde san juan de los morros hasta caracas',
  {
    threadId: 'user-123-session-1',
    resourceId: 'user-123',
    maxSteps: 10, // Permite múltiples iteraciones para completar el flujo
  }
);
```

**Valor por defecto:** 1 (solo una iteración)
**Recomendado:** 10 para flujos complejos que requieren múltiples herramientas
```

---

## 🔧 Cambios Técnicos Detallados

### Archivo: `src/mastra/agents/mobility-agent.ts`

**Cambios principales:**
1. Modificar sección "Location Understanding" para enfatizar búsqueda automática
2. Agregar sección "Automatic Flow Completion"
3. Actualizar "Trip State Management" para incluir continuidad automática
4. Actualizar Example Flows con flujo completo automático

### Archivo: `src/mastra/tools/route-calculator-tool.ts`

**Cambios principales:**
1. Agregar manejo específico para `ZERO_RESULTS`
2. Implementar fallback a cálculo estimado
3. Mejorar mensajes de error
4. Agregar campo `warning` opcional en respuesta

### Archivo: `README.md`

**Cambios principales:**
1. Agregar sección sobre `maxSteps`
2. Actualizar ejemplos de uso
3. Documentar comportamiento automático del agente

---

## ✅ Criterios de Éxito

1. **Búsqueda Automática:**
   - ✅ El agente busca coordenadas automáticamente cuando solo tiene nombres
   - ✅ No pregunta al usuario a menos que haya múltiples candidatos

2. **Flujo Automático:**
   - ✅ El agente completa el flujo completo (búsqueda → estado → ruta) automáticamente
   - ✅ No requiere múltiples interacciones del usuario

3. **Manejo de Errores:**
   - ✅ ZERO_RESULTS se maneja con fallback a cálculo estimado
   - ✅ Mensajes de error son útiles y descriptivos

---

## 📊 Orden de Implementación

1. **Fase 1:** Modificar instrucciones del agente (prioridad alta)
2. **Fase 2:** Mejorar manejo de errores en route calculator (prioridad alta)
3. **Fase 3:** Documentar uso de maxSteps (prioridad media)
4. **Fase 4:** (Opcional) Mejorar tripStateTool (prioridad baja)

---

## ⚠️ Consideraciones

1. **maxSteps:** Aunque se puede configurar en la llamada, las instrucciones mejoradas ayudarán al agente a entender que debe continuar automáticamente
2. **Costo:** Más iteraciones = más tokens, pero mejor experiencia de usuario
3. **Testing:** Probar con diferentes escenarios:
   - Nombres de ciudades
   - Direcciones completas
   - Múltiples candidatos
   - Errores de API

---

**Estado:** ✅ Implementación completada

## 📋 Cambios Implementados

### ✅ Fase 1: Instrucciones del Agente Mejoradas

1. **Estrategia de Resolución de Ubicación Inteligente:**
   - ✅ El agente ahora distingue entre lugares específicos y ciudades genéricas
   - ✅ Para lugares específicos (aeropuerto, plaza, restaurante): busca automáticamente
   - ✅ Para ciudades genéricas (Caracas, San Juan de los Morros): pregunta por ubicación exacta
   - ✅ Instrucciones claras sobre cuándo preguntar y cuándo buscar

2. **Flujo Automático:**
   - ✅ Instrucciones actualizadas para que el agente complete automáticamente el flujo completo
   - ✅ Después de establecer origen y destino con coordenadas, calcula la ruta automáticamente
   - ✅ No espera confirmación del usuario cuando tiene toda la información

3. **Ejemplos de Flujo Actualizados:**
   - ✅ Ejemplo específico para ciudades genéricas (Caracas → San Juan de los Morros)
   - ✅ Ejemplo para lugares específicos (Plaza Bolívar → Aeropuerto)
   - ✅ Todos los ejemplos muestran flujo automático completo

### ✅ Fase 2: Manejo de Errores Mejorado

1. **Manejo de ZERO_RESULTS:**
   - ✅ Detección específica de `ZERO_RESULTS` de Google Maps Directions API
   - ✅ Fallback automático a cálculo estimado usando fórmula de Haversine
   - ✅ Mensaje de advertencia claro para el usuario

2. **Manejo de Otros Errores:**
   - ✅ Manejo de `NOT_FOUND` e `INVALID_REQUEST` con fallback
   - ✅ Mensajes de error más descriptivos
   - ✅ Campo `warning` opcional en el schema de salida

### ✅ Fase 3: Documentación Actualizada

1. **README.md:**
   - ✅ Sección sobre `maxSteps` agregada
   - ✅ Ejemplos actualizados con `maxSteps: 10`
   - ✅ Sección sobre comportamiento inteligente del agente
   - ✅ Explicación de cuándo busca automáticamente vs cuándo pregunta

---

## 🎯 Resultados Esperados

Con estos cambios, el agente ahora:

1. ✅ **Pregunta inteligentemente** cuando las ciudades son genéricas (Caracas, San Juan de los Morros)
2. ✅ **Busca automáticamente** cuando son lugares específicos (Aeropuerto, Plaza Bolívar)
3. ✅ **Completa el flujo automáticamente** cuando tiene toda la información
4. ✅ **Maneja errores gracefully** con fallback a cálculo estimado
5. ✅ **Documentación clara** sobre cómo usar `maxSteps` para flujos complejos

