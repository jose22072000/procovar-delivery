/**
 * Seed de datos de prueba para ProCovar Delivery
 * Órdenes de entrega reales en São Paulo, Brasil
 * con coordenadas GPS, vehículos asignados y precios calculados
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Haversine distance
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcPrice(distKm, weightKg, baseFee, costPerKm, costPerKg) {
  return baseFee + distKm * costPerKm + weightKg * costPerKg
}

const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
if (!admin) { console.error('No admin user found'); process.exit(1) }

// Obtener vehículos existentes
const vehicles = await prisma.vehicle.findMany({ where: { userId: admin.id } })
const camion   = vehicles.find(v => v.name.includes('Camión'))
const furgon   = vehicles.find(v => v.name.includes('Furgoneta'))
const moto     = vehicles.find(v => v.name.includes('Moto'))

if (!camion || !furgon || !moto) {
  console.error('No se encontraron los vehículos de prueba. Ejecuta seed-vehicles primero.')
  process.exit(1)
}

// Puntos de partida (almacenes / depósitos)
const deposito1 = { lat: -23.548, lng: -46.634, address: 'Av. Paulista, 1374 - Bela Vista, São Paulo' }
const deposito2 = { lat: -23.595, lng: -46.686, address: 'Av. das Nações Unidas, 12000 - Brooklin, São Paulo' }

// Órdenes de entrega con destinos reales en SP
const ordersData = [
  {
    customerName: 'Supermercado Pão de Açúcar',
    address: 'Av. Brigadeiro Faria Lima, 2232 - Jardim Paulistano, São Paulo',
    startAddress: deposito1.address,
    endAddress: 'Av. Brigadeiro Faria Lima, 2232 - Jardim Paulistano, São Paulo',
    startLat: deposito1.lat, startLng: deposito1.lng,
    endLat: -23.5765, endLng: -46.6923,
    weight: 850,
    notes: 'Entrega de productos refrigerados. Requiere firma del responsable.',
    vehicleId: camion.id,
    status: 'delivered',
  },
  {
    customerName: 'Farmácia Drogasil - Vila Mariana',
    address: 'Rua Domingos de Morais, 2187 - Vila Mariana, São Paulo',
    startAddress: deposito1.address,
    endAddress: 'Rua Domingos de Morais, 2187 - Vila Mariana, São Paulo',
    startLat: deposito1.lat, startLng: deposito1.lng,
    endLat: -23.5902, endLng: -46.6321,
    weight: 45,
    notes: 'Medicamentos. Entrega urgente antes de las 12h.',
    vehicleId: moto.id,
    status: 'in_transit',
  },
  {
    customerName: 'Livraria Cultura - Conjunto Nacional',
    address: 'Av. Paulista, 2073 - Bela Vista, São Paulo',
    startAddress: deposito1.address,
    endAddress: 'Av. Paulista, 2073 - Bela Vista, São Paulo',
    startLat: deposito1.lat, startLng: deposito1.lng,
    endLat: -23.5614, endLng: -46.6564,
    weight: 120,
    notes: 'Libros y papelería. Frágil - no apilar.',
    vehicleId: furgon.id,
    status: 'pending',
  },
  {
    customerName: 'Restaurante Figueira Rubaiyat',
    address: 'Rua Haddock Lobo, 1738 - Jardins, São Paulo',
    startAddress: deposito2.address,
    endAddress: 'Rua Haddock Lobo, 1738 - Jardins, São Paulo',
    startLat: deposito2.lat, startLng: deposito2.lng,
    endLat: -23.5641, endLng: -46.6712,
    weight: 320,
    notes: 'Insumos de cocina. Horario de recepción: 07h-10h únicamente.',
    vehicleId: furgon.id,
    status: 'pending',
  },
  {
    customerName: 'Hospital Sírio-Libanês',
    address: 'R. Dona Adma Jafet, 91 - Bela Vista, São Paulo',
    startAddress: deposito1.address,
    endAddress: 'R. Dona Adma Jafet, 91 - Bela Vista, São Paulo',
    startLat: deposito1.lat, startLng: deposito1.lng,
    endLat: -23.5582, endLng: -46.6571,
    weight: 200,
    notes: 'Material médico. PRIORITARIO. Contactar al recibir.',
    vehicleId: moto.id,
    status: 'pending',
  },
  {
    customerName: 'Shopping Morumbi',
    address: 'Av. Roque Petroni Júnior, 1089 - Jardim das Acácias, São Paulo',
    startAddress: deposito2.address,
    endAddress: 'Av. Roque Petroni Júnior, 1089 - Jardim das Acácias, São Paulo',
    startLat: deposito2.lat, startLng: deposito2.lng,
    endLat: -23.6264, endLng: -46.6988,
    weight: 1200,
    notes: 'Mercancía para tiendas. Acceso por portería de carga.',
    vehicleId: camion.id,
    status: 'pending',
  },
]

let created = 0
for (const o of ordersData) {
  const distKm = haversineDistance(o.startLat, o.startLng, o.endLat, o.endLng)
  const v = vehicles.find(v => v.id === o.vehicleId)
  const price = calcPrice(distKm, o.weight, v.baseFee, v.costPerKm, v.costPerKg)

  const order = await prisma.order.create({
    data: {
      customerName: o.customerName,
      address: o.address,
      startAddress: o.startAddress,
      endAddress: o.endAddress,
      startLat: o.startLat,
      startLng: o.startLng,
      endLat: o.endLat,
      endLng: o.endLng,
      lat: o.endLat,
      lng: o.endLng,
      weight: o.weight,
      notes: o.notes,
      status: o.status,
      price: Math.round(price * 100) / 100,
      vehicleId: o.vehicleId,
      userId: admin.id,
    }
  })

  await prisma.orderVehicle.create({
    data: { orderId: order.id, vehicleId: o.vehicleId, isPrimary: true }
  })

  console.log(`✓ ${o.customerName} → $${order.price?.toFixed(2)} (${distKm.toFixed(1)} km, ${o.weight} kg)`)
  created++
}

await prisma.$disconnect()
console.log(`\nSeed completo: ${created} órdenes creadas.`)
