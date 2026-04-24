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
      orders: {
        select: { id: true, customerName: true, address: true, status: true, weight: true, lat: true, lng: true, price: true, stopOrder: true }
      }
    }
  })

  return NextResponse.json(routes)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, orderIds } = await req.json()

  if (!name) {
    return NextResponse.json({ error: 'Route name is required' }, { status: 400 })
  }

  const settings = await prisma.settings.findFirst()
  const config = {
    baseFee: settings?.baseFee || 5,
    costPerKm: settings?.costPerKm || 1.5,
    costPerKg: settings?.costPerKg || 0.5,
  }

  const route = await prisma.route.create({
    data: {
      name,
      userId: user.id as string,
    }
  })

  if (orderIds && orderIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, userId: user.id as string }
    })

    const ordersWithCoords = orders.filter((o) => o.lat && o.lng)
    let optimizedOrder: string[] = orderIds

    if (ordersWithCoords.length === orders.length && orders.length > 1) {
      const stops = orders.map((o) => ({ id: o.id, lat: o.lat!, lng: o.lng! }))
      optimizedOrder = greedyRouteOptimization(stops)
    }

    let totalDistance = 0
    let totalWeight = 0
    let totalPrice = 0

    const ordersMap = Object.fromEntries(orders.map((o) => [o.id, o]))

    for (let i = 0; i < optimizedOrder.length; i++) {
      const orderId = optimizedOrder[i]
      const order = ordersMap[orderId]

      let distanceKm = 0
      if (i > 0 && order.lat && order.lng) {
        const prevOrder = ordersMap[optimizedOrder[i - 1]]
        if (prevOrder.lat && prevOrder.lng) {
          distanceKm = haversineDistance(prevOrder.lat, prevOrder.lng, order.lat, order.lng)
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
    include: { orders: true }
  })

  return NextResponse.json(fullRoute, { status: 201 })
}
