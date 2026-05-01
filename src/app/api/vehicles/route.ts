import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vehicles = await prisma.vehicle.findMany({
    where: { userId: user.id as string },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { routes: true, orders: true, orderAssignments: true } }
    }
  })

  return NextResponse.json(vehicles)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, type, plate, capacity, baseFee, costPerKm, costPerKg, status, notes } = await req.json()

  if (!name) {
    return NextResponse.json({ error: 'Vehicle name is required' }, { status: 400 })
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      name,
      type: type || 'truck',
      plate: plate || null,
      capacity: capacity ?? 1000,
      baseFee: baseFee ?? 5.0,
      costPerKm: costPerKm ?? 1.5,
      costPerKg: costPerKg ?? 0.5,
      status: status || 'available',
      notes: notes || null,
      userId: user.id as string,
    }
  })

  return NextResponse.json(vehicle, { status: 201 })
}
