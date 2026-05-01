import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function ensureAdmin(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null }
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }), user: null }
  return { error: null, user }
}

export async function GET(req: NextRequest) {
  const auth = ensureAdmin(req)
  if (auth.error) return auth.error

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
          routes: true,
          vehicles: true,
        }
      }
    }
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const auth = ensureAdmin(req)
  if (auth.error) return auth.error

  const { email, password, name, role } = await req.json()

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 10)
  const created = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      role: typeof role === 'string' && role ? role : 'operator',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    }
  })

  return NextResponse.json(created, { status: 201 })
}
