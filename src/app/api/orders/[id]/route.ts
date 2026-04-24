import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.order.findFirst({
    where: { id, userId: user.id as string }
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()

  const order = await prisma.order.findFirst({
    where: { id, userId: user.id as string }
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.order.update({
    where: { id },
    data: {
      ...(data.customerName !== undefined && { customerName: data.customerName }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.lat !== undefined && { lat: data.lat }),
      ...(data.lng !== undefined && { lng: data.lng }),
      ...(data.weight !== undefined && { weight: data.weight }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.routeId !== undefined && { routeId: data.routeId }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.stopOrder !== undefined && { stopOrder: data.stopOrder }),
      ...(data.status === 'delivered' && { deliveredAt: new Date() }),
    }
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
