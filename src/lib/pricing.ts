export interface PricingConfig {
  baseFee: number
  costPerKm: number
  costPerKg: number
}

export function calculateOrderPrice(
  distanceKm: number,
  weightKg: number,
  config: PricingConfig
): number {
  return config.baseFee + distanceKm * config.costPerKm + weightKg * config.costPerKg
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
  stops: Array<{ id: string; lat: number; lng: number }>
): string[] {
  if (stops.length <= 1) return stops.map((s) => s.id)

  const unvisited = [...stops]
  const route: string[] = []

  let current = unvisited.shift()!
  route.push(current.id)

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
    route.push(current.id)
  }

  return route
}
