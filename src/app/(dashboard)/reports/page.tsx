'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@iconify/react'

interface Vehicle {
  id: string
  name: string
  plate: string | null
}

interface Order {
  id: string
  customerName: string
  address: string
  startAddress?: string | null
  endAddress?: string | null
  weight: number
  price?: number | null
  createdAt: string
  vehicleAssignments?: Array<{ vehicle: { id: string; name: string; plate?: string | null } }>
}

interface VehicleSummary {
  name: string
  plate: string | null
  count: number
  revenue: number
  weight: number
}

interface ReportData {
  orders: Order[]
  summary: { totalOrders: number; totalRevenue: number; totalWeight: number; avgPrice: number }
  byVehicle: VehicleSummary[]
}

type Tab = 'resumen' | 'vehiculos' | 'ordenes'

export default function ReportsPage() {
  const { token } = useAppStore()
  const [activeTab, setActiveTab] = useState<Tab>('resumen')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await axios.get('/api/vehicles', { headers: { Authorization: `Bearer ${token}` } })
      return res.data
    },
    enabled: !!token,
  })

  const params = new URLSearchParams()
  if (dateFrom) params.set('from', dateFrom)
  if (dateTo) params.set('to', dateTo)
  if (vehicleFilter) params.set('vehicleId', vehicleFilter)

  const { data, isLoading } = useQuery<ReportData>({
    queryKey: ['reports', dateFrom, dateTo, vehicleFilter],
    queryFn: async () => {
      const res = await axios.get(`/api/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data
    },
    enabled: !!token,
  })

  const summary = data?.summary
  const orders = data?.orders || []
  const byVehicle = data?.byVehicle || []

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setVehicleFilter('') }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'resumen', label: 'Resumen', icon: 'mdi:chart-pie' },
    { key: 'vehiculos', label: 'Por Vehículo', icon: 'mdi:truck-outline' },
    { key: 'ordenes', label: 'Detalle de Órdenes', icon: 'mdi:package-variant-closed' },
  ]

  return (
    <div className="flex flex-col">
      <Navbar title="Reportes" />
      <div className="p-6 space-y-5">

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2 text-sm">
            <Icon icon="mdi:filter-outline" className="text-lg text-primary" /> Filtros
          </h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehículo</label>
              <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]">
                <option value="">Todos los vehículos</option>
                {(vehicles as Vehicle[]).map((v) => (
                  <option key={v.id} value={v.id}>{v.name}{v.plate ? ` (${v.plate})` : ''}</option>
                ))}
              </select>
            </div>
            {(dateFrom || dateTo || vehicleFilter) && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border rounded-xl">
                <Icon icon="mdi:close" className="text-base" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon icon={tab.icon} className="text-base" />
                {tab.label}
                {tab.key === 'ordenes' && orders.length > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {orders.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="p-16 text-center text-gray-400">
              <Icon icon="mdi:loading" className="text-4xl mx-auto mb-3 animate-spin" />
              <p>Cargando reporte...</p>
            </div>
          ) : (
            <div className="p-6">

              {/* TAB: RESUMEN */}
              {activeTab === 'resumen' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="mdi:package-variant-closed" className="text-blue-500 text-xl" />
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Órdenes</p>
                      </div>
                      <p className="text-4xl font-bold text-gray-800">{summary?.totalOrders || 0}</p>
                    </div>
                    <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="mdi:currency-usd" className="text-green-500 text-xl" />
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Ingresos Totales</p>
                      </div>
                      <p className="text-4xl font-bold text-gray-800">${(summary?.totalRevenue || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="mdi:chart-line" className="text-purple-500 text-xl" />
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Precio Promedio</p>
                      </div>
                      <p className="text-4xl font-bold text-gray-800">${(summary?.avgPrice || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="mdi:weight" className="text-yellow-500 text-xl" />
                        <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Peso Total</p>
                      </div>
                      <p className="text-4xl font-bold text-gray-800">{(summary?.totalWeight || 0).toFixed(1)}<span className="text-xl font-normal text-gray-500 ml-1">kg</span></p>
                    </div>
                  </div>

                  {/* Mini resumen por vehículo en el tab resumen */}
                  {byVehicle.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Icon icon="mdi:truck-outline" className="text-primary" /> Top vehículos
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {byVehicle.slice(0, 3).map((v, i) => (
                          <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Icon icon="mdi:truck-outline" className="text-blue-600 text-xl" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{v.name}</p>
                              {v.plate && <p className="text-xs text-gray-400 font-mono">{v.plate}</p>}
                              <p className="text-sm text-green-700 font-semibold">${v.revenue.toFixed(2)} · {v.count} órdenes</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {orders.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Icon icon="mdi:file-chart-outline" className="text-5xl mx-auto mb-3" />
                      <p>No hay órdenes para los filtros seleccionados.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: POR VEHÍCULO */}
              {activeTab === 'vehiculos' && (
                byVehicle.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Icon icon="mdi:truck-outline" className="text-5xl mx-auto mb-3" />
                    <p>No hay datos de vehículos para los filtros seleccionados.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Vehículo</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Placa</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Órdenes</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Ingresos</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Peso Total</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Promedio/Orden</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byVehicle.map((v, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium flex items-center gap-2">
                              <Icon icon="mdi:truck-outline" className="text-gray-400" /> {v.name}
                            </td>
                            <td className="py-3 px-4 text-gray-500 font-mono text-xs">{v.plate || '—'}</td>
                            <td className="py-3 px-4 text-right font-semibold">{v.count}</td>
                            <td className="py-3 px-4 text-right font-semibold text-green-700">${v.revenue.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right">{v.weight.toFixed(1)} kg</td>
                            <td className="py-3 px-4 text-right text-blue-600 font-medium">
                              ${v.count > 0 ? (v.revenue / v.count).toFixed(2) : '0.00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2">
                          <td colSpan={2} className="py-3 px-4 font-bold text-gray-700">Totales</td>
                          <td className="py-3 px-4 text-right font-bold">{byVehicle.reduce((s, v) => s + v.count, 0)}</td>
                          <td className="py-3 px-4 text-right font-bold text-green-700">${byVehicle.reduce((s, v) => s + v.revenue, 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-bold">{byVehicle.reduce((s, v) => s + v.weight, 0).toFixed(1)} kg</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              )}

              {/* TAB: DETALLE DE ÓRDENES */}
              {activeTab === 'ordenes' && (
                orders.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Icon icon="mdi:package-variant-closed-remove" className="text-5xl mx-auto mb-3" />
                    <p>No hay órdenes para los filtros seleccionados.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Fecha</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Cliente</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Origen</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Destino</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Vehículo</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Peso</th>
                          <th className="text-right py-3 px-4 font-semibold text-gray-600">Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <tr key={order.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                              {new Date(order.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-4 font-medium">{order.customerName}</td>
                            <td className="py-3 px-4 text-gray-600 max-w-[140px] truncate text-xs">{order.startAddress || '—'}</td>
                            <td className="py-3 px-4 text-gray-600 max-w-[140px] truncate text-xs">{order.endAddress || order.address}</td>
                            <td className="py-3 px-4 text-gray-600 text-xs">
                              {order.vehicleAssignments && order.vehicleAssignments.length > 0
                                ? order.vehicleAssignments.map((a) => a.vehicle.name).join(', ')
                                : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">{order.weight} kg</td>
                            <td className="py-3 px-4 text-right font-semibold text-green-700">
                              {order.price != null ? `$${order.price.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2">
                          <td colSpan={5} className="py-3 px-4 font-bold text-gray-700 text-right">Totales:</td>
                          <td className="py-3 px-4 text-right font-bold">
                            {orders.reduce((s, o) => s + o.weight, 0).toFixed(1)} kg
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-green-700">
                            ${orders.reduce((s, o) => s + (o.price || 0), 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

