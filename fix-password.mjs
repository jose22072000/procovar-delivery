import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const hash = await bcrypt.hash('admin123', 10)
await prisma.user.update({ where: { email: 'admin@procovar.com' }, data: { password: hash } })
const user = await prisma.user.findUnique({ where: { email: 'admin@procovar.com' }, select: { email: true, name: true, role: true } })
console.log('Done. User:', user)
await prisma.$disconnect()
