import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orders = await prisma.order.findMany({
    where: { userId: user.id as string },
    orderBy: { createdAt: 'desc' },
    include: { route: { select: { id: true, name: true } } }
  })

  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customerName, address, lat, lng, weight, notes } = await req.json()

  if (!customerName || !address) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const order = await prisma.order.create({
    data: {
      customerName,
      address,
      lat: lat || null,
      lng: lng || null,
      weight: weight || 1,
      notes: notes || null,
      userId: user.id as string,
    }
  })

  return NextResponse.json(order, { status: 201 })
}
