export interface PricingConfig {
  baseFee: number
  costPerKm: number
  costPerKg: number
}

export function calculateOrderPrice(
  segmentKm: number,
  weightKg: number,
  config: PricingConfig
): number {
  return config.baseFee + segmentKm * 2 * config.costPerKm + weightKg * config.costPerKg
}

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function greedyRouteOptimization(
  origin: { lat: number; lng: number },
  stops: Array<{ id: string; lat: number; lng: number }>
): string[] {
  if (stops.length === 0) return []
  if (stops.length === 1) return [stops[0].id]

  const unvisited = [...stops]
  const route: string[] = []

  let current: { lat: number; lng: number } = origin

  while (unvisited.length > 0) {
    let nearestIdx = 0
    let nearestDist = Infinity

    for (let i = 0; i < unvisited.length; i++) {
      const dist = haversineDistance(
        current.lat, current.lng,
        unvisited[i].lat, unvisited[i].lng
      )
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = i
      }
    }

    current = unvisited.splice(nearestIdx, 1)[0]
    route.push((current as { id: string; lat: number; lng: number }).id)
  }

  return route
}

/**
 * Returns the actual driving distances between consecutive stops (origin → stop1 → stop2 → ...).
 * Used only for route totalDistance (km reales del camión).
 */
export function calculateRouteSegments(
  origin: { lat: number; lng: number },
  orderedStops: Array<{ lat: number; lng: number }>
): number[] {
  const segments: number[] = []
  let prev = origin
  for (const stop of orderedStops) {
    segments.push(haversineDistance(prev.lat, prev.lng, stop.lat, stop.lng))
    prev = stop
  }
  return segments
}

/**
 * Returns the distance from the origin to each stop individually (not cumulative).
 * Used for per-client pricing: each client pays based on how far they are from the depot,
 * regardless of route order.
 */
export function calculateClientDistances(
  origin: { lat: number; lng: number },
  stops: Array<{ lat: number; lng: number }>
): number[] {
  return stops.map((stop) => haversineDistance(origin.lat, origin.lng, stop.lat, stop.lng))
}

/**
 * Segment-based fare allocation.
 *
 * The whole trip's distance cost is split equally among all clients (so no single
 * client pays for the entire transport). On top of that equal share, each stop pays
 * for the inter-stop legs accumulated to reach it — so the first stop pays only the
 * equal share and each later stop pays progressively more.
 *
 *   totalDistance = depot→s1→…→sN→depot (km, incl. return)
 *   base          = totalDistance × costPerKm / N
 *   cumKm[i]      = Σ legs from s1 to s_i (0 for the first stop)
 *   price[i]      = base + cumKm[i] × costPerKm
 */
export function computeRoutePricing(
  origin: { lat: number; lng: number },
  orderedStops: Array<{ lat: number; lng: number }>,
  costPerKm: number
): { totalDistance: number; cumKm: number[]; prices: number[] } {
  const n = orderedStops.length
  const segments = calculateRouteSegments(origin, orderedStops) // [depot→s1, s1→s2, …]

  let totalDistance = segments.reduce((a, b) => a + b, 0)
  if (n > 0) {
    const last = orderedStops[n - 1]
    totalDistance += haversineDistance(last.lat, last.lng, origin.lat, origin.lng)
  }

  const cumKm: number[] = []
  let acc = 0
  for (let i = 0; i < n; i++) {
    if (i >= 1) acc += segments[i] // inter-stop leg s_{i-1}→s_i
    cumKm.push(acc)
  }

  const base = n > 0 ? (totalDistance * costPerKm) / n : 0
  const prices = cumKm.map((km) => base + km * costPerKm)

  return { totalDistance, cumKm, prices }
}
