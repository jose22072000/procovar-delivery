import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [totalOrders, totalVehicles, orders] = await Promise.all([
    prisma.order.count({ where: { userId: user.id as string } }),
    prisma.vehicle.count({ where: { userId: user.id as string } }),
    prisma.order.findMany({
      where: { userId: user.id as string },
      select: { price: true, weight: true },
    }),
  ])

  const totalRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0)
  const totalWeight = orders.reduce((sum, o) => sum + (o.weight || 0), 0)
  const avgPrice = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return NextResponse.json({
    totalOrders,
    totalVehicles,
    totalRevenue,
    totalWeight,
    avgPrice,
  })
}
