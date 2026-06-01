# Diseño: Corrección de Precios, Orígenes Guardados e Identificación de Rutas

**Fecha:** 2026-06-01  
**Proyecto:** ProCovar Delivery  
**Enfoque:** Opción A — Fixes quirúrgicos sin reestructurar lo que funciona

---

## Contexto y modelo de negocio

La aplicación calcula el costo de transporte de delivery para múltiples clientes en una sola ruta. El transporte sale desde un punto fijo (depósito), hace entregas en varios puntos y a veces recoge pedidos en el regreso.

**Regla de negocio clave:** Cada cliente paga según la distancia desde el origen hasta su ubicación (no desde la parada anterior). El factor `×2` cubre el costo del viaje de regreso del transporte, distribuido en el precio de cada cliente.

**Fórmula correcta por cliente:**
```
precio = tarifa_base + (distancia_origen→cliente × 2 × costo_km) + (peso × costo_kg)
```

---

## Bug crítico identificado

`pricing.ts:12` calcula `segmentKm` como la distancia entre paradas consecutivas (greedy route), pero debe ser la distancia directa desde el origen hasta cada cliente individualmente.

**Actual (incorrecto):**  
`precio_cliente = baseFee + distancia(parada_anterior → cliente) × 2 × costPerKm + peso × costPerKg`

**Correcto:**  
`precio_cliente = baseFee + distancia(origen → cliente) × 2 × costPerKm + peso × costPerKg`

La distancia real recorrida por el camión (suma de segmentos consecutivos) se sigue calculando para `totalDistance` de la ruta (útil para logística), pero ya no se usa para el precio individual de cada cliente.

---

## Cambios al schema de Prisma

### Nuevo modelo `SavedOrigin`

```prisma
model SavedOrigin {
  id        String   @id @default(cuid())
  name      String
  address   String
  lat       Float
  lng       Float
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

Relación agregada en `User`:
```prisma
savedOrigins SavedOrigin[]
```

### Cambios en `Route`

```prisma
name      String?   // era requerido, ahora opcional
routeCode String?   // nuevo — auto-generado: "RT-20260601-001"
```

### Sin cambios en `Order`

`segmentKm Float?` ya existe. Solo cambia su significado semántico: ahora almacena la distancia desde el origen hasta ese cliente (no desde la parada anterior).

### Compatibilidad SQLite + Prisma

- `SavedOrigin` es tabla nueva → migración `CREATE TABLE` limpia
- `name String?` en Route → `ALTER TABLE` implícito (SQLite lo maneja mediante recreación de tabla en Prisma)
- `routeCode String?` → columna nueva nullable, rutas existentes quedan con `null`
- No hay cambios destructivos en datos existentes

---

## Cambios en lógica de pricing (`src/lib/pricing.ts`)

### Nueva función

```ts
// Distancia desde el origen hasta cada parada (para precios individuales)
export function calculateClientDistances(
  origin: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }>
): number[]
```

Retorna `haversineDistance(origin, stop)` para cada stop — sin acumulación.

### Función existente se mantiene

`calculateRouteSegments` sigue calculando distancias entre paradas consecutivas, pero ahora solo se usa para `totalDistance` de la ruta (km reales recorridos por el camión).

### `calculateOrderPrice` sin cambios

La fórmula `baseFee + segmentKm * 2 * costPerKm + weight * costPerKg` es correcta — solo cambia qué significa `segmentKm` al llamarla.

---

## Cambios en API

### Nuevo endpoint `/api/origins`

**GET** — Lista los `SavedOrigin` del usuario autenticado  
**POST** — Crea un nuevo origen guardado (requiere: `name`, `address`, `lat`, `lng`)  

### Nuevo endpoint `/api/origins/[id]`

**DELETE** — Elimina un origen guardado (verifica que pertenece al usuario)

### Cambios en `POST /api/routes`

1. `name` pasa a ser opcional en validación
2. Auto-genera `routeCode`:
   - Formato: `RT-YYYYMMDD-NNN` donde NNN es el número de ruta del día (01, 02...)
   - Consulta cuántas rutas existen con ese prefijo de fecha para determinar el siguiente número
3. Reemplaza `calculateRouteSegments` por `calculateClientDistances` para precios individuales
4. Mantiene `calculateRouteSegments` para `totalDistance`

### Cambios en `PATCH /api/routes/[id]`

1. Mismo fix de pricing al re-optimizar (usa `calculateClientDistances`)
2. Agrega validación de capacidad: si `totalWeight > vehicle.capacity`, retorna `400` con mensaje descriptivo

### Sin cambios en

- `GET /api/routes`, auth, usuarios, vehículos, reports, driver view

---

## Cambios en UI

### Página de Rutas (`/routes`)

**Modal "Nueva Ruta":**
- Agrega selector de origen guardado (dropdown cargado desde `/api/origins`)
- Opción "+ Guardar este origen" inline al geocodificar uno nuevo
- Campo `name` ahora marcado como opcional con placeholder "Opcional — el código se genera automáticamente"

**Tarjetas de ruta:**
- `routeCode` se muestra prominentemente (badge superior)
- `name` aparece como subtítulo si existe
- Advertencia visual (badge amarillo) si `totalWeight > vehicle.capacity`

### Página de Configuración (`/settings`)

- Traducida completamente al español
- Fórmula actualizada: `precio = tarifa_base + (distancia_km × 2 × costo_km) + (peso_kg × costo_kg)`
- El ejemplo numérico refleja la fórmula con `×2`

---

## Alcance explícitamente excluido

- No se cambia el algoritmo de optimización de rutas (greedy nearest-neighbor es suficiente)
- No se agregan roles adicionales ni permisos
- No se modifica la vista del conductor
- No se cambia el sistema de auth
- No se migran precios de rutas existentes (quedan con datos legacy — el usuario puede regenerar las rutas si necesita precios correctos)

---

## Orden de implementación sugerido

1. Migración de Prisma (schema changes)
2. Fix de `pricing.ts` (`calculateClientDistances`)
3. API de orígenes guardados
4. Fix de pricing en `POST /api/routes` y `PATCH /api/routes/[id]` + generación de `routeCode`
5. UI: selector de origen en modal de rutas + display de `routeCode`
6. UI: traducción y fix de fórmula en Settings
