import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [totalOrders, totalRoutes, deliveredOrders] = await Promise.all([
    prisma.order.count({ where: { userId: user.id as string } }),
    prisma.route.count({ where: { userId: user.id as string } }),
    prisma.order.count({ where: { userId: user.id as string, status: 'delivered' } }),
  ])

  const routes = await prisma.route.findMany({
    where: { userId: user.id as string },
    select: { totalDistance: true, totalPrice: true }
  })

  const totalRevenue = routes.reduce((sum, r) => sum + (r.totalPrice || 0), 0)
  const totalDistance = routes.reduce((sum, r) => sum + (r.totalDistance || 0), 0)

  return NextResponse.json({
    totalOrders,
    totalRoutes,
    deliveredOrders,
    pendingOrders: totalOrders - deliveredOrders,
    totalRevenue,
    totalDistance,
  })
}
