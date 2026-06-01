import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { greedyRouteOptimization, calculateRouteSegments, calculateClientDistances, calculateOrderPrice } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

async function generateRouteCode(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `RT-${dateStr}-`

  const count = await prisma.route.count({
    where: { routeCode: { startsWith: prefix } },
  })

  const seq = String(count + 1).padStart(3, '0')
  return `${prefix}${seq}`
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const routes = await prisma.route.findMany({
    where: { userId: user.id as string },
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle: { select: { id: true, name: true, type: true, plate: true, capacity: true } },
      orders: {
        orderBy: { stopOrder: 'asc' },
        select: {
          id: true,
          operationNumber: true,
          customerName: true,
          address: true,
          endAddress: true,
          endLat: true,
          endLng: true,
          status: true,
          weight: true,
          lat: true,
          lng: true,
          price: true,
          segmentKm: true,
          stopOrder: true,
          tripLeg: true,
        }
      }
    }
  })

  return NextResponse.json(routes)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    name,
    vehicleId,
    originAddress,
    originLat,
    originLng,
    outboundOrderIds = [],
    returnOrderIds = [],
  } = await req.json()

  if (!originLat || !originLng) {
    return NextResponse.json({ error: 'Las coordenadas de origen son requeridas' }, { status: 400 })
  }

  const allOrderIds = [...outboundOrderIds, ...returnOrderIds]
  if (allOrderIds.length === 0) {
    return NextResponse.json({ error: 'Se requiere al menos un pedido' }, { status: 400 })
  }

  // Load global pricing settings
  let settings = await prisma.settings.findFirst()
  if (!settings) {
    settings = await prisma.settings.create({
      data: { baseFee: 5.0, costPerKm: 1.5, costPerKg: 0.5 }
    })
  }
  const config = {
    baseFee: settings.baseFee,
    costPerKm: settings.costPerKm,
    costPerKg: settings.costPerKg,
  }

  // Validate vehicle capacity
  if (vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId } })
    const orders = await prisma.order.findMany({ where: { id: { in: allOrderIds } } })
    const totalWeight = orders.reduce((sum, o) => sum + o.weight, 0)
    if (vehicle && totalWeight > vehicle.capacity) {
      return NextResponse.json({
        error: `Peso total (${totalWeight.toFixed(1)} kg) supera la capacidad del vehículo (${vehicle.capacity} kg)`
      }, { status: 400 })
    }
  }

  const origin = { lat: originLat, lng: originLng }

  const outboundOrders = outboundOrderIds.length > 0
    ? await prisma.order.findMany({ where: { id: { in: outboundOrderIds }, userId: user.id as string } })
    : []

  if (outboundOrders.length !== outboundOrderIds.length) {
    return NextResponse.json({ error: 'Uno o más pedidos de salida no encontrados' }, { status: 404 })
  }

  const returnOrders = returnOrderIds.length > 0
    ? await prisma.order.findMany({ where: { id: { in: returnOrderIds }, userId: user.id as string } })
    : []

  if (returnOrders.length !== returnOrderIds.length) {
    return NextResponse.json({ error: 'Uno o más pedidos de retorno no encontrados' }, { status: 404 })
  }

  const routeCode = await generateRouteCode()

  const route = await prisma.route.create({
    data: {
      name: name || null,
      routeCode,
      userId: user.id as string,
      ...(vehicleId && { vehicleId }),
      originAddress: originAddress ?? null,
      originLat,
      originLng,
    }
  })

  let totalDistance = 0
  let totalWeight = 0
  let totalPrice = 0

  async function assignStops(
    orders: typeof outboundOrders,
    tripLeg: string,
    stopOffset: number
  ) {
    const ordersWithCoords = orders.filter((o) => (o.endLat ?? o.lat) && (o.endLng ?? o.lng))
    let optimizedIds = orders.map((o) => o.id)

    if (ordersWithCoords.length === orders.length && orders.length > 1) {
      const stops = orders.map((o) => ({ id: o.id, lat: (o.endLat ?? o.lat)!, lng: (o.endLng ?? o.lng)! }))
      optimizedIds = greedyRouteOptimization(origin, stops)
    }

    const ordersMap = Object.fromEntries(orders.map((o) => [o.id, o]))
    const orderedStops = optimizedIds.map((id) => {
      const o = ordersMap[id]
      return { id: o.id, lat: (o.endLat ?? o.lat)!, lng: (o.endLng ?? o.lng)! }
    })

    // Actual driving distance (for totalDistance on route)
    const drivingSegments = calculateRouteSegments(origin, orderedStops)
    // Per-client distance from origin (for pricing)
    const clientDistances = calculateClientDistances(origin, orderedStops)

    for (let i = 0; i < optimizedIds.length; i++) {
      const orderId = optimizedIds[i]
      const order = ordersMap[orderId]
      const segmentKm = clientDistances[i] ?? 0
      const price = calculateOrderPrice(segmentKm, order.weight, config)

      totalDistance += drivingSegments[i] ?? 0
      totalWeight += order.weight
      totalPrice += price

      await prisma.order.update({
        where: { id: orderId },
        data: {
          routeId: route.id,
          stopOrder: stopOffset + i + 1,
          tripLeg,
          price,
          segmentKm,
        }
      })
    }

    return optimizedIds.length
  }

  const outboundCount = await assignStops(outboundOrders, 'outbound', 0)
  await assignStops(returnOrders, 'return', outboundCount)

  await prisma.route.update({
    where: { id: route.id },
    data: {
      totalDistance,
      totalWeight,
      totalPrice,
      optimized: true,
    }
  })

  if (vehicleId) {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'in_use' },
    })
  }

  const fullRoute = await prisma.route.findUnique({
    where: { id: route.id },
    include: {
      vehicle: { select: { id: true, name: true, type: true, plate: true, capacity: true } },
      orders: { orderBy: { stopOrder: 'asc' } }
    }
  })

  return NextResponse.json(fullRoute, { status: 201 })
}
