import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let settings = await prisma.settings.findFirst()
  if (!settings) {
    settings = await prisma.settings.create({ data: {} })
  }

  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { baseFee, costPerKm, costPerKg, currency } = await req.json()

  let settings = await prisma.settings.findFirst()

  if (settings) {
    settings = await prisma.settings.update({
      where: { id: settings.id },
      data: {
        ...(baseFee !== undefined && { baseFee }),
        ...(costPerKm !== undefined && { costPerKm }),
        ...(costPerKg !== undefined && { costPerKg }),
        ...(currency !== undefined && { currency }),
      }
    })
  } else {
    settings = await prisma.settings.create({
      data: { baseFee, costPerKm, costPerKg, currency }
    })
  }

  return NextResponse.json(settings)
}
