import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const route = await prisma.route.findFirst({
    where: { id: params.id, userId: user.id as string },
    include: {
      orders: {
        orderBy: { stopOrder: 'asc' }
      }
    }
  })

  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(route)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  const route = await prisma.route.findFirst({
    where: { id: params.id, userId: user.id as string }
  })
  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.route.update({
    where: { id: params.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.status !== undefined && { status: data.status }),
    }
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const route = await prisma.route.findFirst({
    where: { id: params.id, userId: user.id as string }
  })
  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.order.updateMany({
    where: { routeId: params.id },
    data: { routeId: null, stopOrder: null }
  })

  await prisma.route.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
