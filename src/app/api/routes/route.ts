import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { greedyRouteOptimization, haversineDistance, calculateOrderPrice } from '@/lib/pricing'

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
        select: {
          id: true,
          customerName: true,
          address: true,
          startAddress: true,
          endAddress: true,
          startLat: true,
          startLng: true,
          endLat: true,
          endLng: true,
          status: true,
          weight: true,
          lat: true,
          lng: true,
          price: true,
          stopOrder: true
        }
      }
    }
  })

  return NextResponse.json(routes)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, orderIds, vehicleId } = await req.json()

  if (!name) {
    return NextResponse.json({ error: 'Route name is required' }, { status: 400 })
  }

  if (!vehicleId) {
    return NextResponse.json({ error: 'Vehicle is required to calculate transportation cost' }, { status: 400 })
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, userId: user.id as string }
  })

  if (!vehicle) {
    return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
  }

  if (vehicle.status === 'maintenance') {
    return NextResponse.json({ error: 'Vehicle is in maintenance and cannot be assigned' }, { status: 400 })
  }

  const config = {
    baseFee: vehicle.baseFee,
    costPerKm: vehicle.costPerKm,
    costPerKg: vehicle.costPerKg,
  }

  const route = await prisma.route.create({
    data: {
      name,
      userId: user.id as string,
      vehicleId,
    }
  })

  if (orderIds && orderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, userId: user.id as string },
      include: {
        vehicleAssignments: {
          select: { vehicleId: true }
        }
      }
    })

    if (orders.length !== orderIds.length) {
      return NextResponse.json({ error: 'One or more orders were not found' }, { status: 404 })
    }

    const incompatibleOrder = orders.find((order) => {
      if (order.vehicleAssignments.length === 0) return false
      return !order.vehicleAssignments.some((assignment) => assignment.vehicleId === vehicleId)
    })

    if (incompatibleOrder) {
      return NextResponse.json({
        error: `Order ${incompatibleOrder.customerName} is not assigned to the selected vehicle`
      }, { status: 400 })
    }

    const ordersWithCoords = orders.filter((o) => (o.endLat ?? o.lat) && (o.endLng ?? o.lng))
    let optimizedOrder: string[] = orderIds

    if (ordersWithCoords.length === orders.length && orders.length > 1) {
      const stops = orders.map((o) => ({ id: o.id, lat: (o.endLat ?? o.lat)!, lng: (o.endLng ?? o.lng)! }))
      optimizedOrder = greedyRouteOptimization(stops)
    }

    let totalDistance = 0
    let totalWeight = 0
    let totalPrice = 0

    const ordersMap = Object.fromEntries(orders.map((o) => [o.id, o]))

    for (let i = 0; i < optimizedOrder.length; i++) {
      const orderId = optimizedOrder[i]
      const order = ordersMap[orderId]
      const currentLat = order.endLat ?? order.lat
      const currentLng = order.endLng ?? order.lng

      let distanceKm = 0
      if (i > 0 && currentLat && currentLng) {
        const prevOrder = ordersMap[optimizedOrder[i - 1]]
        const prevLat = prevOrder.endLat ?? prevOrder.lat
        const prevLng = prevOrder.endLng ?? prevOrder.lng
        if (prevLat && prevLng) {
          distanceKm = haversineDistance(prevLat, prevLng, currentLat, currentLng)
        }
      }

      const price = calculateOrderPrice(distanceKm, order.weight, config)
      totalDistance += distanceKm
      totalWeight += order.weight
      totalPrice += price

      await prisma.order.update({
        where: { id: orderId },
        data: { routeId: route.id, stopOrder: i + 1, price }
      })
    }

    await prisma.route.update({
      where: { id: route.id },
      data: {
        totalDistance,
        totalWeight,
        totalPrice,
        optimized: ordersWithCoords.length === orders.length,
      }
    })
  }

  const fullRoute = await prisma.route.findUnique({
    where: { id: route.id },
    include: {
      vehicle: { select: { id: true, name: true, type: true, plate: true } },
      orders: true
    }
  })

  return NextResponse.json(fullRoute, { status: 201 })
}
