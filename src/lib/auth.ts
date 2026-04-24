import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

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

export function getUserFromRequest(req: NextRequest): Record<string, unknown> | null {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyToken(token)
}
