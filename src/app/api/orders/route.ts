import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'
import { haversineDistance, calculateOrderPrice } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orders = await prisma.order.findMany({
    where: { userId: user.id as string },
    orderBy: { createdAt: 'desc' },
    include: {
      route: { select: { id: true, name: true } },
      vehicle: { select: { id: true, name: true, type: true, plate: true } },
      vehicleAssignments: {
        include: {
          vehicle: { select: { id: true, name: true, type: true, plate: true, status: true, capacity: true, baseFee: true, costPerKm: true, costPerKg: true } }
        }
      }
    }
  })

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    customerName,
    address,
    startAddress,
    endAddress,
    startLat,
    startLng,
    endLat,
    endLng,
    lat,
    lng,
    weight,
    notes,
    vehicleId,
    vehicleIds,
  } = await req.json()

  if (!customerName || !address) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const normalizedVehicleIds = Array.from(new Set(
    (Array.isArray(vehicleIds) ? vehicleIds : vehicleId ? [vehicleId] : [])
      .filter((id: unknown) => typeof id === 'string' && id)
  )) as string[]

  if (normalizedVehicleIds.length > 0) {
    const validVehicles = await prisma.vehicle.count({
      where: {
        id: { in: normalizedVehicleIds },
        userId: user.id as string,
      }
    })
    if (validVehicles !== normalizedVehicleIds.length) {
      return NextResponse.json({ error: 'One or more vehicles are invalid' }, { status: 400 })
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customerName,
        address,
        startAddress: startAddress || null,
        endAddress: endAddress || null,
        startLat: startLat ?? null,
        startLng: startLng ?? null,
        endLat: endLat ?? null,
        endLng: endLng ?? null,
        lat: lat ?? endLat ?? null,
        lng: lng ?? endLng ?? null,
        weight: weight || 1,
        notes: notes || null,
        vehicleId: normalizedVehicleIds[0] || null,
        userId: user.id as string,
      }
    })

    if (normalizedVehicleIds.length > 0) {
      await tx.orderVehicle.createMany({
        data: normalizedVehicleIds.map((id, idx) => ({
          orderId: created.id,
          vehicleId: id,
          isPrimary: idx === 0,
        }))
      })
    }

    return tx.order.findUnique({
      where: { id: created.id },
      include: {
        route: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true, type: true, plate: true } },
        vehicleAssignments: {
          include: {
            vehicle: { select: { id: true, name: true, type: true, plate: true, status: true, capacity: true, baseFee: true, costPerKm: true, costPerKg: true } }
          }
        }
      }
    })
  })

  // Auto-calculate price if vehicle + start/end coordinates are provided
  if (order && normalizedVehicleIds.length > 0 && order.startLat && order.startLng && order.endLat && order.endLng) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: normalizedVehicleIds[0], userId: user.id as string }
    })
    if (vehicle) {
      let distanceKm = haversineDistance(order.startLat, order.startLng, order.endLat, order.endLng)
      try {
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${order.startLng},${order.startLat};${order.endLng},${order.endLat}?overview=false`
        )
        const osrmData = await osrmRes.json() as { routes?: Array<{ distance: number }> }
        if (osrmData.routes?.[0]) distanceKm = osrmData.routes[0].distance / 1000
      } catch { /* fallback to haversine */ }
      const price = calculateOrderPrice(distanceKm, order.weight, {
        baseFee: vehicle.baseFee,
        costPerKm: vehicle.costPerKm,
        costPerKg: vehicle.costPerKg,
      })
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { price },
        include: {
          route: { select: { id: true, name: true } },
          vehicle: { select: { id: true, name: true, type: true, plate: true } },
          vehicleAssignments: {
            include: {
              vehicle: { select: { id: true, name: true, type: true, plate: true, status: true, capacity: true, baseFee: true, costPerKm: true, costPerKg: true } }
            }
          }
        }
      })
      return NextResponse.json(updated, { status: 201 })
    }
  }

  return NextResponse.json(order, { status: 201 })
}
