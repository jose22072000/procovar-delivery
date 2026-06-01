import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { greedyRouteOptimization, calculateRouteSegments, calculateOrderPrice } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const routes = await prisma.route.findMany({
    where: { userId: user.id as string },
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle: { select: { id: true, name: true, type: true, plate: true } },
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

  if (!name) {
    return NextResponse.json({ error: 'Route name is required' }, { status: 400 })
  }

  if (!originLat || !originLng) {
    return NextResponse.json({ error: 'Origin coordinates are required' }, { status: 400 })
  }

  const allOrderIds = [...outboundOrderIds, ...returnOrderIds]
  if (allOrderIds.length === 0) {
    return NextResponse.json({ error: 'At least one order is required' }, { status: 400 })
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

  const origin = { lat: originLat, lng: originLng }

  // Load outbound orders
  const outboundOrders = outboundOrderIds.length > 0
    ? await prisma.order.findMany({ where: { id: { in: outboundOrderIds }, userId: user.id as string } })
    : []

  if (outboundOrders.length !== outboundOrderIds.length) {
    return NextResponse.json({ error: 'One or more outbound orders not found' }, { status: 404 })
  }

  // Load return orders
  const returnOrders = returnOrderIds.length > 0
    ? await prisma.order.findMany({ where: { id: { in: returnOrderIds }, userId: user.id as string } })
    : []

  if (returnOrders.length !== returnOrderIds.length) {
    return NextResponse.json({ error: 'One or more return orders not found' }, { status: 404 })
  }

  // Create the route
  const route = await prisma.route.create({
    data: {
      name,
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

  // Helper: assign stops for a given leg
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

    const segments = calculateRouteSegments(origin, orderedStops)

    for (let i = 0; i < optimizedIds.length; i++) {
      const orderId = optimizedIds[i]
      const order = ordersMap[orderId]
      const segmentKm = segments[i] ?? 0
      const price = calculateOrderPrice(segmentKm, order.weight, config)

      totalDistance += segmentKm
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

  // Auto-disable vehicle when assigned to route
  if (vehicleId) {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'in_use' },
    })
  }

  const fullRoute = await prisma.route.findUnique({
    where: { id: route.id },
    include: {
      vehicle: { select: { id: true, name: true, type: true, plate: true } },
      orders: { orderBy: { stopOrder: 'asc' } }
    }
  })

  return NextResponse.json(fullRoute, { status: 201 })
}



