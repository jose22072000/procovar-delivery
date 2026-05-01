'use client'

import { Icon } from '@iconify/react'

interface Order {
  id: string
  customerName: string
  address: string
  startAddress?: string | null
  endAddress?: string | null
  startLat?: number | null
  startLng?: number | null
  endLat?: number | null
  endLng?: number | null
  lat?: number | null
  lng?: number | null
  weight: number
  status: string
  price?: number | null
  createdAt: string
  vehicle?: { id: string; name: string } | null
  vehicleAssignments?: Array<{
    vehicleId: string
    vehicle: {
      id: string
      name: string
      plate?: string | null
    }
  }>
}

interface OrderTableProps {
  orders: Order[]
  onEdit?: (order: Order) => void
  onDelete?: (id: string) => void
  onViewMap?: (order: Order) => void
}

function hasCoords(order: Order): boolean {
  return !!((order.startLat || order.lat) && (order.endLat || order.lng))
}

export default function OrderTable({ orders, onEdit, onDelete, onViewMap }: OrderTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Cliente</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Ruta</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Peso</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Vehículo</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Precio</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Fecha</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4 font-medium">{order.customerName}</td>
              <td className="py-3 px-4 text-gray-600 max-w-xs">
                <div className="flex items-center gap-1 truncate text-xs">
                  <span className="inline-block w-4 h-4 rounded-full bg-green-500 text-white text-center leading-4 text-[9px] font-bold flex-shrink-0">A</span>
                  <span className="truncate">{order.startAddress || 'Origen'}</span>
                </div>
                <div className="flex items-center gap-1 truncate text-xs mt-0.5">
                  <span className="inline-block w-4 h-4 rounded-full bg-red-500 text-white text-center leading-4 text-[9px] font-bold flex-shrink-0">B</span>
                  <span className="truncate">{order.endAddress || order.address}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-gray-600">{order.weight} kg</td>
              <td className="py-3 px-4 text-gray-600 max-w-[180px] truncate">
                {order.vehicleAssignments && order.vehicleAssignments.length > 0
                  ? order.vehicleAssignments.map((a) => a.vehicle.name).join(', ')
                  : '-'}
              </td>
              <td className="py-3 px-4">
                {order.price != null
                  ? <span className="font-semibold text-green-700">${order.price.toFixed(2)}</span>
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                {new Date(order.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="py-3 px-4">
                <div className="flex gap-1 items-center">
                  {onViewMap && hasCoords(order) && (
                    <div className="relative group">
                      <button
                        onClick={() => onViewMap(order)}
                        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 hover:text-green-800 transition-colors"
                      >
                        <Icon icon="mdi:map-marker-path" className="text-base" />
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-20 shadow-lg">
                        Ver ruta en mapa
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                      </div>
                    </div>
                  )}
                  {onEdit && (
                    <div className="relative group">
                      <button
                        onClick={() => onEdit(order)}
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                      >
                        <Icon icon="mdi:pencil-outline" className="text-base" />
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-20 shadow-lg">
                        Editar
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                      </div>
                    </div>
                  )}
                  {onDelete && (
                    <div className="relative group">
                      <button
                        onClick={() => onDelete(order.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                      >
                        <Icon icon="mdi:trash-can-outline" className="text-base" />
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-20 shadow-lg">
                        Eliminar
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                      </div>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No hay órdenes. ¡Crea la primera orden!
        </div>
      )}
    </div>
  )
}
