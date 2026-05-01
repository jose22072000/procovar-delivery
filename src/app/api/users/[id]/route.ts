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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = ensureAdmin(req)
  if (auth.error) return auth.error

  const { id } = await params
  const { name, role, password } = await req.json()

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const data: { name?: string; role?: string; password?: string } = {}

  if (name !== undefined) data.name = name
  if (role !== undefined) data.role = role
  if (password) data.password = await bcrypt.hash(password, 10)

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    }
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = ensureAdmin(req)
  if (auth.error) return auth.error

  const { id } = await params

  if (id === auth.user!.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
