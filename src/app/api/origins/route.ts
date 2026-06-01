import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const origins = await prisma.savedOrigin.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(origins)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, address, lat, lng } = await req.json()

  if (!name || !address || lat == null || lng == null) {
    return NextResponse.json({ error: 'Faltan campos requeridos: name, address, lat, lng' }, { status: 400 })
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat y lng deben ser números' }, { status: 400 })
  }

  const origin = await prisma.savedOrigin.create({
    data: { name, address, lat, lng, userId: user.id },
  })

  return NextResponse.json(origin, { status: 201 })
}
