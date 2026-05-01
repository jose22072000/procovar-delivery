import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
if (!admin) { console.error('No admin user found'); process.exit(1) }

const vehicles = [
  { name: 'Camión Grande', type: 'truck', plate: 'ABC-1234', capacity: 5000, baseFee: 20, costPerKm: 3.5, costPerKg: 0.8, status: 'available', userId: admin.id },
  { name: 'Furgoneta Express', type: 'van', plate: 'XYZ-5678', capacity: 1000, baseFee: 10, costPerKm: 2.0, costPerKg: 0.5, status: 'available', userId: admin.id },
  { name: 'Moto Rápida', type: 'motorcycle', plate: 'MOT-999', capacity: 50, baseFee: 5, costPerKm: 0.8, costPerKg: 0.2, status: 'available', userId: admin.id },
]

for (const v of vehicles) {
  const created = await prisma.vehicle.create({ data: v })
  console.log('Created vehicle:', created.name, created.id)
}

await prisma.$disconnect()
console.log('Done!')
