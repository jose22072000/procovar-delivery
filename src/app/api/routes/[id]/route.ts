import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { greedyRouteOptimization, calculateRouteSegments, calculateClientDistances, calculateOrderPrice } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const route = await prisma.route.findFirst({
    where: { id, userId: user.id as string },
    include: {
      orders: { orderBy: { stopOrder: 'asc' } }
    }
  })

  if (!route) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(route)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  const route = await prisma.route.findFirst({
    where: { id, userId: user.id as string },
    include: { orders: { orderBy: { stopOrder: 'asc' } }, vehicle: true }
  })
  if (!route) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const routeOrders = route.orders

  // --- Vehicle assignment (auto-enable/disable) ---
  if (data.vehicleId !== undefined) {
    if (route.vehicleId && route.vehicleId !== data.vehicleId) {
      const oldVehicle = await prisma.vehicle.findFirst({ where: { id: route.vehicleId } })
      if (oldVehicle?.status === 'in_use') {
        await prisma.vehicle.update({ where: { id: route.vehicleId }, data: { status: 'available' } })
      }
    }
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
      include: { vehicle: { select: { id: true, name: true, type: true, plate: true, capacity: true } } }
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

    const allNewIds = [...addOutboundIds, ...addReturnIds]
    if (allNewIds.length > 0) {
      const newOrders = await prisma.order.findMany({
        where: { id: { in: allNewIds }, userId: user.id as string }
      })
      if (newOrders.length !== allNewIds.length) {
        return NextResponse.json({ error: 'Uno o más pedidos no encontrados' }, { status: 404 })
      }

      // Validate capacity if vehicle assigned
      const assignedVehicle = route.vehicle
      if (route.vehicleId && assignedVehicle) {
        const newWeight = newOrders.reduce((sum, o) => sum + o.weight, 0)
        const existingWeight = route.orders.reduce((sum, o) => sum + o.weight, 0)
        const totalWeight = existingWeight + newWeight
        if (totalWeight > assignedVehicle.capacity) {
          return NextResponse.json({
            error: `Peso total (${totalWeight.toFixed(1)} kg) supera la capacidad del vehículo (${assignedVehicle.capacity} kg)`
          }, { status: 400 })
        }
      }
    }

    async function reOptimizeLeg(
      existingOrders: typeof routeOrders,
      newOrderIds: string[],
      leg: string,
      stopOffset: number
    ) {
      const newDbOrders = newOrderIds.length > 0
        ? await prisma.order.findMany({ where: { id: { in: newOrderIds } } })
        : []

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

      const drivingSegments = calculateRouteSegments(origin, orderedStops)
      const clientDistances = calculateClientDistances(origin, orderedStops)

      let distance = 0, weight = 0, totalPriceLocal = 0

      for (let i = 0; i < optimizedIds.length; i++) {
        const oid = optimizedIds[i]
        const order = ordersMap[oid]
        const segmentKm = clientDistances[i] ?? 0
        const price = calculateOrderPrice(segmentKm, order.weight, config)
        distance += drivingSegments[i] ?? 0
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
      const result = await reOptimizeLeg(existingOutbound, addOutboundIds, 'outbound', 0)
      totalDistance += result.distance
      totalWeight += result.weight
      totalPrice += result.price
      route.orders
        .filter((o) => o.tripLeg === 'return')
        .forEach((o) => {
          totalDistance += o.segmentKm ?? 0
          totalWeight += o.weight
          totalPrice += o.price ?? 0
        })
      const newOutboundCount = existingOutbound.length + addOutboundIds.length
      let returnIdx = 0
      for (const o of route.orders.filter((x) => x.tripLeg === 'return').sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0))) {
        await prisma.order.update({ where: { id: o.id }, data: { stopOrder: newOutboundCount + returnIdx + 1 } })
        returnIdx++
      }
    } else {
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
  if (!route) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

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
