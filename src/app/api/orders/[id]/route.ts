import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.order.findFirst({
    where: { id, userId: user.id as string },
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

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  const normalizedVehicleIds = data.vehicleIds !== undefined
    ? Array.from(new Set(
      (Array.isArray(data.vehicleIds) ? data.vehicleIds : [])
        .filter((vehicleId: unknown) => typeof vehicleId === 'string' && vehicleId)
    )) as string[]
    : undefined

  const order = await prisma.order.findFirst({
    where: { id, userId: user.id as string }
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (normalizedVehicleIds !== undefined && normalizedVehicleIds.length > 0) {
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

  const updated = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: {
        ...(data.customerName !== undefined && { customerName: data.customerName }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.startAddress !== undefined && { startAddress: data.startAddress }),
        ...(data.endAddress !== undefined && { endAddress: data.endAddress }),
        ...(data.startLat !== undefined && { startLat: data.startLat }),
        ...(data.startLng !== undefined && { startLng: data.startLng }),
        ...(data.endLat !== undefined && { endLat: data.endLat }),
        ...(data.endLng !== undefined && { endLng: data.endLng }),
        ...(data.lat !== undefined && { lat: data.lat }),
        ...(data.lng !== undefined && { lng: data.lng }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.routeId !== undefined && { routeId: data.routeId }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.stopOrder !== undefined && { stopOrder: data.stopOrder }),
        ...(data.status === 'delivered' && { deliveredAt: new Date() }),
        ...(normalizedVehicleIds !== undefined && { vehicleId: normalizedVehicleIds[0] || null }),
      }
    })

    if (normalizedVehicleIds !== undefined) {
      await tx.orderVehicle.deleteMany({ where: { orderId: id } })
      if (normalizedVehicleIds.length > 0) {
        await tx.orderVehicle.createMany({
          data: normalizedVehicleIds.map((vehicleId, idx) => ({
            orderId: id,
            vehicleId,
            isPrimary: idx === 0,
          }))
        })
      }
    }

    return tx.order.findUnique({
      where: { id },
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

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.order.findFirst({
    where: { id, userId: user.id as string }
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.order.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
