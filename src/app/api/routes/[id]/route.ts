import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { greedyRouteOptimization, calculateRouteSegments, calculateOrderPrice } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const route = await prisma.route.findFirst({
    where: { id, userId: user.id as string },
    include: {
      orders: {
        orderBy: { stopOrder: 'asc' }
      }
    }
  })

  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(route)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  const route = await prisma.route.findFirst({
    where: { id, userId: user.id as string },
    include: { orders: { orderBy: { stopOrder: 'asc' } } }
  })
  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // --- Vehicle assignment (auto-enable/disable) ---
  if (data.vehicleId !== undefined) {
    // Re-enable old vehicle if it was in_use due to this route
    if (route.vehicleId && route.vehicleId !== data.vehicleId) {
      const oldVehicle = await prisma.vehicle.findFirst({ where: { id: route.vehicleId } })
      if (oldVehicle?.status === 'in_use') {
        await prisma.vehicle.update({ where: { id: route.vehicleId }, data: { status: 'available' } })
      }
    }
    // Disable new vehicle
    if (data.vehicleId) {
      await prisma.vehicle.update({ where: { id: data.vehicleId }, data: { status: 'in_use' } })
    }
    const simpleUpdate = await prisma.route.update({
      where: { id },
      data: {
        vehicleId: data.vehicleId || null,
        ...(data.name !== undefined && { name: data.name }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: { vehicle: { select: { id: true, name: true, type: true, plate: true } } }
    })
    return NextResponse.json(simpleUpdate)
  }

  // --- Add outbound or return orders with full re-optimization ---
  const addOutboundIds: string[] = data.addOutboundOrderIds ?? []
  const addReturnIds: string[] = data.addReturnOrderIds ?? []

  if (addOutboundIds.length > 0 || addReturnIds.length > 0) {
    let settings = await prisma.settings.findFirst()
    if (!settings) {
      settings = await prisma.settings.create({ data: { baseFee: 5.0, costPerKm: 1.5, costPerKg: 0.5 } })
    }
    const config = { baseFee: settings.baseFee, costPerKm: settings.costPerKm, costPerKg: settings.costPerKg }
    const origin = { lat: route.originLat ?? 0, lng: route.originLng ?? 0 }

    // Validate new orders belong to user and are unassigned
    const allNewIds = [...addOutboundIds, ...addReturnIds]
    if (allNewIds.length > 0) {
      const newOrders = await prisma.order.findMany({
        where: { id: { in: allNewIds }, userId: user.id as string }
      })
      if (newOrders.length !== allNewIds.length) {
        return NextResponse.json({ error: 'One or more orders not found' }, { status: 404 })
      }
    }

    // Helper: re-optimize an entire leg
    async function reOptimizeLeg(
      existingOrders: typeof route.orders,
      newOrderIds: string[],
      leg: string,
      stopOffset: number
    ) {
      // Load new order details
      const newDbOrders = newOrderIds.length > 0
        ? await prisma.order.findMany({ where: { id: { in: newOrderIds } } })
        : []

      // Combine all orders for this leg
      const allOrders = [...existingOrders, ...newDbOrders]
      if (allOrders.length === 0) return { distance: 0, weight: 0, price: 0, count: 0 }

      const ordersWithCoords = allOrders.filter((o) => (o.endLat ?? o.lat) && (o.endLng ?? o.lng))
      let optimizedIds = allOrders.map((o) => o.id)

      if (ordersWithCoords.length === allOrders.length && allOrders.length > 1) {
        const stops = allOrders.map((o) => ({ id: o.id, lat: (o.endLat ?? o.lat)!, lng: (o.endLng ?? o.lng)! }))
        optimizedIds = greedyRouteOptimization(origin, stops)
      }

      const ordersMap = Object.fromEntries(allOrders.map((o) => [o.id, o]))
      const orderedStops = optimizedIds.map((oid) => {
        const o = ordersMap[oid]
        return { id: o.id, lat: (o.endLat ?? o.lat)!, lng: (o.endLng ?? o.lng)! }
      })
      const segments = calculateRouteSegments(origin, orderedStops)

      let distance = 0, weight = 0, totalPriceLocal = 0

      for (let i = 0; i < optimizedIds.length; i++) {
        const oid = optimizedIds[i]
        const order = ordersMap[oid]
        const segmentKm = segments[i] ?? 0
        const price = calculateOrderPrice(segmentKm, order.weight, config)
        distance += segmentKm
        weight += order.weight
        totalPriceLocal += price

        await prisma.order.update({
          where: { id: oid },
          data: { routeId: id, stopOrder: stopOffset + i + 1, tripLeg: leg, price, segmentKm }
        })
      }

      return { distance, weight, price: totalPriceLocal, count: optimizedIds.length }
    }

    const existingOutbound = addOutboundIds.length > 0
      ? route.orders.filter((o) => o.tripLeg !== 'return')
      : []
    const existingReturn = addReturnIds.length > 0
      ? route.orders.filter((o) => o.tripLeg === 'return')
      : []

    let totalDistance = 0
    let totalWeight = 0
    let totalPrice = 0

    if (addOutboundIds.length > 0) {
      // Re-optimize full outbound leg
      const result = await reOptimizeLeg(existingOutbound, addOutboundIds, 'outbound', 0)
      totalDistance += result.distance
      totalWeight += result.weight
      totalPrice += result.price
      // Keep existing return totals as-is
      route.orders
        .filter((o) => o.tripLeg === 'return')
        .forEach((o) => {
          totalDistance += o.segmentKm ?? 0
          totalWeight += o.weight
          totalPrice += o.price ?? 0
        })
      // Re-sequence return stops after outbound count
      const newOutboundCount = existingOutbound.length + addOutboundIds.length
      let returnIdx = 0
      for (const o of route.orders.filter((x) => x.tripLeg === 'return').sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0))) {
        await prisma.order.update({ where: { id: o.id }, data: { stopOrder: newOutboundCount + returnIdx + 1 } })
        returnIdx++
      }
    } else {
      // Re-optimize full return leg; keep existing outbound totals
      route.orders
        .filter((o) => o.tripLeg !== 'return')
        .forEach((o) => {
          totalDistance += o.segmentKm ?? 0
          totalWeight += o.weight
          totalPrice += o.price ?? 0
        })
      const outboundCount = route.orders.filter((o) => o.tripLeg !== 'return').length
      const result = await reOptimizeLeg(existingReturn, addReturnIds, 'return', outboundCount)
      totalDistance += result.distance
      totalWeight += result.weight
      totalPrice += result.price
    }

    const updated = await prisma.route.update({
      where: { id },
      data: {
        totalDistance,
        totalWeight,
        totalPrice,
        ...(data.name !== undefined && { name: data.name }),
        ...(data.status !== undefined && { status: data.status }),
      }
    })
    return NextResponse.json(updated)
  }

  // --- Simple field updates ---
  const updated = await prisma.route.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.status !== undefined && { status: data.status }),
    }
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const route = await prisma.route.findFirst({
    where: { id, userId: user.id as string }
  })
  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Re-enable vehicle if it was in_use because of this route
  if (route.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: route.vehicleId } })
    if (vehicle?.status === 'in_use') {
      await prisma.vehicle.update({ where: { id: route.vehicleId }, data: { status: 'available' } })
    }
  }

  await prisma.order.updateMany({
    where: { routeId: id },
    data: { routeId: null, stopOrder: null, tripLeg: 'outbound', price: null, segmentKm: null }
  })

  await prisma.route.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

