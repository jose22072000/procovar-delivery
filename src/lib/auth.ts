import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set')
}

const JWT_SECRET = process.env.JWT_SECRET as string

export function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const cookieToken = req.cookies.get('token')?.value
  return cookieToken || null
}

export function getUserFromRequest(req: NextRequest): AuthUser | null {
  const token = getTokenFromRequest(req)
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null

  const id = payload.id
  const email = payload.email
  const name = payload.name
  const role = payload.role

  if (typeof id !== 'string' || typeof email !== 'string' || typeof name !== 'string' || typeof role !== 'string') {
    return null
  }

  return { id, email, name, role }
}
