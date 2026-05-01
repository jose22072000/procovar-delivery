import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, signToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, role } = await req.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const usersCount = await prisma.user.count()
    const requester = getUserFromRequest(req)

    if (usersCount > 0 && (!requester || requester.role !== 'admin')) {
      return NextResponse.json({ error: 'Only administrators can create users' }, { status: 403 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const allowedRole = typeof role === 'string' && role ? role : 'operator'
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: usersCount === 0 ? 'admin' : allowedRole,
      }
    })

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role })

    const settingsCount = await prisma.settings.count()
    if (settingsCount === 0) {
      await prisma.settings.create({ data: {} })
    }

    if (usersCount === 0) {
      return NextResponse.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      })
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
