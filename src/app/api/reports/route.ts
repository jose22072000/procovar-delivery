import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const vehicleId = searchParams.get('vehicleId')

  const dateFilter = from || to
    ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to + 'T23:59:59.999Z') } : {}),
        },
      }
    : {}

  const vehicleFilter = vehicleId
    ? { vehicleAssignments: { some: { vehicleId } } }
    : {}

  const orders = await prisma.order.findMany({
    where: {
      userId: user.id as string,
      ...dateFilter,
      ...vehicleFilter,
    },
    include: {
      vehicleAssignments: {
        include: { vehicle: { select: { id: true, name: true, plate: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalRevenue = orders.reduce((s, o) => s + (o.price || 0), 0)
  const totalWeight = orders.reduce((s, o) => s + (o.weight || 0), 0)
  const avgPrice = orders.length > 0 ? totalRevenue / orders.length : 0

  // Per-vehicle breakdown
  const byVehicle: Record<string, { name: string; plate: string | null; count: number; revenue: number; weight: number }> = {}
  for (const order of orders) {
    for (const assignment of order.vehicleAssignments) {
      const v = assignment.vehicle
      if (!byVehicle[v.id]) {
        byVehicle[v.id] = { name: v.name, plate: v.plate, count: 0, revenue: 0, weight: 0 }
      }
      byVehicle[v.id].count++
      byVehicle[v.id].revenue += order.price || 0
      byVehicle[v.id].weight += order.weight || 0
    }
  }

  return NextResponse.json({
    orders,
    summary: { totalOrders: orders.length, totalRevenue, totalWeight, avgPrice },
    byVehicle: Object.values(byVehicle),
  })
}
