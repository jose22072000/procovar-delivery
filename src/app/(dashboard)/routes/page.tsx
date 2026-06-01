'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false })

interface RouteOrder {
  id: string
  customerName: string
  operationNumber?: string | null
  address: string
  endAddress?: string | null
  endLat?: number | null
  endLng?: number | null
  lat?: number | null
  lng?: number | null
  status: string
  weight: number
  price?: number | null
  stopOrder?: number | null
  tripLeg?: string | null
  segmentKm?: number | null
}

interface Route {
  id: string
  name: string
  status: string
  totalDistance: number
  totalWeight: number
  totalPrice: number
  originAddress?: string | null
  originLat?: number | null
  originLng?: number | null
  orders: RouteOrder[]
  vehicleId?: string | null
  vehicle?: { id: string; name: string; type: string; plate: string | null } | null
}

interface Vehicle {
  id: string
  name: string
  type: string
  plate: string | null
  capacity: number
  status: string
}

interface UnassignedOrder {
  id: string
  customerName: string
  operationNumber?: string | null
  address: string
  endAddress?: string | null
  weight: number
  routeId?: string | null
}

type NominatimResult = { lat: string; lon: string; display_name: string }

export default function RoutesPage() {
  const { token } = useAppStore()
  const queryClient = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [outboundOrderIds, setOutboundOrderIds] = useState<string[]>([])
  const [returnOrderIds, setReturnOrderIds] = useState<string[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [originAddress, setOriginAddress] = useState('')
  const [originPoint, setOriginPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [isGeocodingOrigin, setIsGeocodingOrigin] = useState(false)
  const [geocodeError, setGeocodeError] = useState('')

  const [showAddOrders, setShowAddOrders] = useState(false)
  const [addOutboundIds, setAddOutboundIds] = useState<string[]>([])
  const [addReturnIds, setAddReturnIds] = useState<string[]>([])
  const [historyTab, setHistoryTab] = useState<'active' | 'history'>('active')

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const res = await axios.get('/api/routes', { headers: { Authorization: `Bearer ${token}` } })
      return res.data as Route[]
    },
    enabled: !!token,
  })

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await axios.get('/api/vehicles', { headers: { Authorization: `Bearer ${token}` } })
      return res.data as Vehicle[]
    },
    enabled: !!token,
  })

  const { data: unassignedOrders = [] } = useQuery({
    queryKey: ['orders-unassigned'],
    queryFn: async () => {
      const res = await axios.get('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      return (res.data as UnassignedOrder[]).filter((o) => !o.routeId)
    },
    enabled: !!token,
  })

  const createRoute = useMutation({
    mutationFn: async (data: unknown) => {
      const res = await axios.post('/api/routes', data, { headers: { Authorization: `Bearer ${token}` } })
      return res.data as Route
    },
    onSuccess: (data: Route) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['orders-unassigned'] })
      resetModal()
      setSelectedRouteId(data.id)
    },
  })

  const addOrdersToRoute = useMutation({
    mutationFn: async ({ routeId, outboundIds, returnIds }: { routeId: string; outboundIds: string[]; returnIds: string[] }) => {
      const res = await axios.patch(
        `/api/routes/${routeId}`,
        { addOutboundOrderIds: outboundIds, addReturnOrderIds: returnIds },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['orders-unassigned'] })
      setShowAddOrders(false)
      setAddOutboundIds([])
      setAddReturnIds([])
    },
  })

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/routes/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['orders-unassigned'] })
      setSelectedRouteId(null)
      setShowAddOrders(false)
      setAddOutboundIds([])
      setAddReturnIds([])
    },
  })

  const resetModal = () => {
    setShowModal(false)
    setRouteName('')
    setSelectedVehicleId('')
    setOutboundOrderIds([])
    setReturnOrderIds([])
    setOriginAddress('')
    setOriginPoint(null)
    setGeocodeError('')
  }

  const geocodeOrigin = async () => {
    if (!originAddress.trim()) return
    setIsGeocodingOrigin(true)
    setGeocodeError('')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(originAddress)}&limit=1`,
        { headers: { 'Accept-Language': 'es' } }
      )
      const data = (await res.json()) as NominatimResult[]
      if (data.length > 0) {
        setOriginPoint({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      } else {
        setGeocodeError('No se encontró la dirección. Intenta ser más específico.')
      }
    } catch {
      setGeocodeError('Error al geocodificar. Verifica tu conexión.')
    } finally {
      setIsGeocodingOrigin(false)
    }
  }

  const handleCreateRoute = () => {
    if (!routeName.trim() || !originPoint) return
    createRoute.mutate({
      name: routeName,
      vehicleId: selectedVehicleId || undefined,
      originAddress: originAddress || undefined,
      originLat: originPoint.lat,
      originLng: originPoint.lng,
      outboundOrderIds,
      returnOrderIds,
    })
  }

  // selectedRoute derived from routes list so it auto-updates after invalidation
  const selectedRoute = (routes as Route[]).find((r) => r.id === selectedRouteId) ?? null

  const activeRoutes = (routes as Route[]).filter((r) => r.status !== 'completed')
  const historyRoutes = (routes as Route[]).filter((r) => r.status === 'completed')
  const visibleRoutes = historyTab === 'active' ? activeRoutes : historyRoutes

  // Build map stops for selected route
  const mapStops: Array<{
    id: string
    lat: number
    lng: number
    label: string
    status?: string
    tripLeg?: 'outbound' | 'return'
    isOrigin?: boolean
  }> = []

  if (selectedRoute) {
    if (selectedRoute.originLat && selectedRoute.originLng) {
      mapStops.push({
        id: 'origin',
        lat: selectedRoute.originLat,
        lng: selectedRoute.originLng,
        label: selectedRoute.originAddress || 'Origen',
        isOrigin: true,
      })
    }
    selectedRoute.orders
      .filter((o) => o.tripLeg !== 'return')
      .sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0))
      .forEach((o) => {
        const lat = o.endLat ?? o.lat
        const lng = o.endLng ?? o.lng
        if (lat && lng) {
          mapStops.push({
            id: o.id,
            lat,
            lng,
            label: `${o.customerName}${o.operationNumber ? ` · Op.${o.operationNumber}` : ''} · ${o.endAddress || o.address}`,
            status: o.status,
            tripLeg: 'outbound',
          })
        }
      })
    selectedRoute.orders
      .filter((o) => o.tripLeg === 'return')
      .sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0))
      .forEach((o) => {
        const lat = o.endLat ?? o.lat
        const lng = o.endLng ?? o.lng
        if (lat && lng) {
          mapStops.push({
            id: o.id,
            lat,
            lng,
            label: `[Retorno] ${o.customerName}${o.operationNumber ? ` · Op.${o.operationNumber}` : ''} · ${o.endAddress || o.address}`,
            status: o.status,
            tripLeg: 'return',
          })
        }
      })
  }

  const outboundStops = selectedRoute?.orders
    .filter((o) => o.tripLeg !== 'return')
    .sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0)) ?? []

  const returnStops = selectedRoute?.orders
    .filter((o) => o.tripLeg === 'return')
    .sort((a, b) => (a.stopOrder ?? 0) - (b.stopOrder ?? 0)) ?? []

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      in_transit: 'bg-blue-100 text-blue-700',
      delivered: 'bg-green-100 text-green-700',
      active: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
    }
    return map[status] ?? 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="flex flex-col">
      <Navbar title="Rutas" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-700">Planificador de Rutas</h3>
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => { setHistoryTab('active'); setSelectedRouteId(null) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${historyTab === 'active' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Activas <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{activeRoutes.length}</span>
              </button>
              <button
                onClick={() => { setHistoryTab('history'); setSelectedRouteId(null) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${historyTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Historial <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{historyRoutes.length}</span>
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            + Nueva Ruta
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: route list */}
          <div className="lg:col-span-1 space-y-3">
            {visibleRoutes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-md">
                {historyTab === 'active' ? 'Sin rutas activas. Crea la primera.' : 'Sin rutas completadas aún.'}
              </div>
            ) : (
              visibleRoutes.map((route) => (
                <div
                  key={route.id}
                  className={`bg-white rounded-2xl shadow-md p-4 cursor-pointer border-2 transition-colors ${
                    selectedRouteId === route.id ? 'border-primary' : 'border-transparent hover:border-blue-200'
                  }`}
                  onClick={() => {
                    setSelectedRouteId(route.id)
                    setShowAddOrders(false)
                    setAddOutboundIds([])
                    setAddReturnIds([])
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">{route.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {route.orders.length} paradas · {route.totalDistance.toFixed(1)} km
                      </p>
                      {route.vehicle && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">🚛 {route.vehicle.name}{route.vehicle.plate ? ` (${route.vehicle.plate})` : ''}</p>
                      )}
                      {route.originAddress && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">📍 {route.originAddress}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ml-2 shrink-0 ${statusBadge(route.status)}`}>
                      {route.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-bold text-primary">${route.totalPrice.toFixed(2)}</span>
                    <div className="flex gap-3">
                      <a
                        href={`/driver/${route.id}`}
                        target="_blank"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Vista conductor →
                      </a>
                      {route.status !== 'completed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteRoute.mutate(route.id) }}
                          className="text-xs text-red-500 hover:underline"
                          disabled={deleteRoute.isPending}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: selected route detail */}
          <div className="lg:col-span-2 space-y-4">
            {selectedRoute ? (
              <>
                {/* Map card */}
                <div className="bg-white rounded-2xl shadow-md p-4">
                  <h3 className="font-bold text-gray-800 mb-2">{selectedRoute.name}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                    <span>🛣️ {selectedRoute.totalDistance.toFixed(1)} km</span>
                    <span>⚖️ {selectedRoute.totalWeight.toFixed(1)} kg</span>
                    <span className="font-semibold text-primary">💰 ${selectedRoute.totalPrice.toFixed(2)}</span>
                    {selectedRoute.vehicle && (
                      <span>🚛 {selectedRoute.vehicle.name}{selectedRoute.vehicle.plate ? ` · ${selectedRoute.vehicle.plate}` : ''}</span>
                    )}
                  </div>
                  {mapStops.length > 0 ? (
                    <MapComponent stops={mapStops} />
                  ) : (
                    <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 text-sm">
                      Sin coordenadas GPS para esta ruta
                    </div>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> Origen
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Salida
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Retorno
                    </span>
                  </div>
                </div>

                {/* Outbound stops */}
                {outboundStops.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-md p-4">
                    <h4 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">→</span>
                      Tramo Salida ({outboundStops.length} paradas)
                    </h4>
                    <div className="space-y-2">
                      {outboundStops.map((order, idx) => (
                        <div key={order.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{order.customerName}</p>
                            {order.operationNumber && (
                              <p className="text-xs text-blue-600">Op. {order.operationNumber}</p>
                            )}
                            <p className="text-xs text-gray-500 truncate">{order.endAddress || order.address}</p>
                          </div>
                          <div className="text-right shrink-0">
                            {order.segmentKm != null && (
                              <p className="text-xs text-gray-500">{order.segmentKm.toFixed(1)} km</p>
                            )}
                            {order.price != null && (
                              <p className="text-xs font-semibold text-blue-700">${order.price.toFixed(2)}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${statusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Return stops */}
                {returnStops.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-md p-4">
                    <h4 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
                      <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs">←</span>
                      Tramo Retorno ({returnStops.length} paradas)
                    </h4>
                    <div className="space-y-2">
                      {returnStops.map((order, idx) => (
                        <div key={order.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                          <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{order.customerName}</p>
                            {order.operationNumber && (
                              <p className="text-xs text-orange-600">Op. {order.operationNumber}</p>
                            )}
                            <p className="text-xs text-gray-500 truncate">{order.endAddress || order.address}</p>
                          </div>
                          <div className="text-right shrink-0">
                            {order.segmentKm != null && (
                              <p className="text-xs text-gray-500">{order.segmentKm.toFixed(1)} km</p>
                            )}
                            {order.price != null && (
                              <p className="text-xs font-semibold text-orange-700">${order.price.toFixed(2)}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${statusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Add Orders to existing route (only for non-completed) */}
                {selectedRoute.status !== 'completed' && (
                <div className="bg-white rounded-2xl shadow-md p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-700">Agregar pedidos a la ruta</h4>
                    <button
                      onClick={() => { setShowAddOrders(!showAddOrders); setAddOutboundIds([]); setAddReturnIds([]) }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {showAddOrders ? 'Cancelar' : '+ Agregar pedidos'}
                    </button>
                  </div>

                  {showAddOrders && (
                    <div className="space-y-4">
                      {/* Outbound orders to add */}
                      <div>
                        <p className="text-sm font-medium text-blue-700 mb-1">Salida ({addOutboundIds.length} seleccionados)</p>
                        <div className="max-h-40 overflow-y-auto border rounded-xl">
                          {(unassignedOrders as UnassignedOrder[]).length === 0 ? (
                            <div className="p-3 text-center text-gray-500 text-sm">Sin pedidos disponibles</div>
                          ) : (
                            (unassignedOrders as UnassignedOrder[]).map((order) => {
                              const inReturn = addReturnIds.includes(order.id)
                              return (
                                <label
                                  key={order.id}
                                  className={`flex items-center gap-3 p-2.5 border-b last:border-0 ${inReturn ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 cursor-pointer'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={addOutboundIds.includes(order.id)}
                                    disabled={inReturn}
                                    onChange={(e) => {
                                      if (e.target.checked) setAddOutboundIds([...addOutboundIds, order.id])
                                      else setAddOutboundIds(addOutboundIds.filter((x) => x !== order.id))
                                    }}
                                    className="rounded accent-blue-600"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{order.customerName}</p>
                                    {order.operationNumber && <p className="text-xs text-blue-600">Op. {order.operationNumber}</p>}
                                    <p className="text-xs text-gray-500 truncate">{order.endAddress || order.address}</p>
                                  </div>
                                  <span className="text-xs text-gray-500 shrink-0">{order.weight} kg</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      </div>

                      {/* Return orders to add */}
                      <div>
                        <p className="text-sm font-medium text-orange-600 mb-1">Retorno ({addReturnIds.length} seleccionados)</p>
                        <div className="max-h-40 overflow-y-auto border rounded-xl">
                          {(unassignedOrders as UnassignedOrder[]).length === 0 ? (
                            <div className="p-3 text-center text-gray-500 text-sm">Sin pedidos disponibles</div>
                          ) : (
                            (unassignedOrders as UnassignedOrder[]).map((order) => {
                              const inOutbound = addOutboundIds.includes(order.id)
                              return (
                                <label
                                  key={order.id}
                                  className={`flex items-center gap-3 p-2.5 border-b last:border-0 ${inOutbound ? 'opacity-40 cursor-not-allowed' : 'hover:bg-orange-50 cursor-pointer'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={addReturnIds.includes(order.id)}
                                    disabled={inOutbound}
                                    onChange={(e) => {
                                      if (e.target.checked) setAddReturnIds([...addReturnIds, order.id])
                                      else setAddReturnIds(addReturnIds.filter((x) => x !== order.id))
                                    }}
                                    className="rounded accent-orange-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{order.customerName}</p>
                                    {order.operationNumber && <p className="text-xs text-orange-600">Op. {order.operationNumber}</p>}
                                    <p className="text-xs text-gray-500 truncate">{order.endAddress || order.address}</p>
                                  </div>
                                  <span className="text-xs text-gray-500 shrink-0">{order.weight} kg</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            if (selectedRouteId && (addOutboundIds.length > 0 || addReturnIds.length > 0)) {
                              addOrdersToRoute.mutate({
                                routeId: selectedRouteId,
                                outboundIds: addOutboundIds,
                                returnIds: addReturnIds,
                              })
                            }
                          }}
                          disabled={
                            (addOutboundIds.length === 0 && addReturnIds.length === 0) ||
                            addOrdersToRoute.isPending
                          }
                          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {addOrdersToRoute.isPending ? 'Optimizando...' : 'Agregar y reoptimizar ruta'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-md p-12 text-center text-gray-500">
                Selecciona una ruta para ver el detalle
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Route Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) resetModal() }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-5">Nueva Ruta</h3>
            <div className="space-y-5">

              {/* Route name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la ruta *</label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Ruta Mañana Norte"
                />
              </div>

              {/* Vehicle (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehículo (opcional)</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Sin asignar —</option>
                  {(vehicles as Vehicle[])
                    .filter((v) => v.status === 'available')
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.plate ? ` (${v.plate})` : ''} · {v.capacity} kg
                      </option>
                    ))}
                </select>
              </div>

              {/* Origin address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Punto de origen *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={originAddress}
                    onChange={(e) => { setOriginAddress(e.target.value); setOriginPoint(null); setGeocodeError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') geocodeOrigin() }}
                    className="flex-1 px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dirección de salida (depósito, sede...)"
                  />
                  <button
                    type="button"
                    onClick={geocodeOrigin}
                    disabled={isGeocodingOrigin || !originAddress.trim()}
                    className="px-4 py-2 bg-gray-100 border rounded-xl text-sm hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
                  >
                    {isGeocodingOrigin ? '...' : '📍 Geocodificar'}
                  </button>
                </div>
                {geocodeError && <p className="text-xs text-red-500 mt-1">{geocodeError}</p>}
                {originPoint && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {originPoint.lat.toFixed(5)}, {originPoint.lng.toFixed(5)}
                  </p>
                )}
              </div>

              {/* Outbound orders */}
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">
                  Pedidos de Salida ({outboundOrderIds.length} seleccionados)
                </label>
                <div className="max-h-48 overflow-y-auto border rounded-xl">
                  {(unassignedOrders as UnassignedOrder[]).length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Sin pedidos sin asignar</div>
                  ) : (
                    (unassignedOrders as UnassignedOrder[]).map((order) => {
                      const isInReturn = returnOrderIds.includes(order.id)
                      return (
                        <label
                          key={order.id}
                          className={`flex items-center gap-3 p-3 border-b last:border-0 ${isInReturn ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            checked={outboundOrderIds.includes(order.id)}
                            disabled={isInReturn}
                            onChange={(e) => {
                              if (e.target.checked) setOutboundOrderIds([...outboundOrderIds, order.id])
                              else setOutboundOrderIds(outboundOrderIds.filter((id) => id !== order.id))
                            }}
                            className="rounded accent-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{order.customerName}</p>
                            {order.operationNumber && (
                              <p className="text-xs text-blue-600">Op. {order.operationNumber}</p>
                            )}
                            <p className="text-xs text-gray-500 truncate">{order.endAddress || order.address}</p>
                          </div>
                          <span className="text-xs text-gray-500 shrink-0">{order.weight} kg</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Return orders */}
              <div>
                <label className="block text-sm font-medium text-orange-600 mb-1">
                  Pedidos de Retorno (opcional — {returnOrderIds.length} seleccionados)
                </label>
                <div className="max-h-48 overflow-y-auto border rounded-xl">
                  {(unassignedOrders as UnassignedOrder[]).length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">Sin pedidos sin asignar</div>
                  ) : (
                    (unassignedOrders as UnassignedOrder[]).map((order) => {
                      const isInOutbound = outboundOrderIds.includes(order.id)
                      return (
                        <label
                          key={order.id}
                          className={`flex items-center gap-3 p-3 border-b last:border-0 ${isInOutbound ? 'opacity-40 cursor-not-allowed' : 'hover:bg-orange-50 cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            checked={returnOrderIds.includes(order.id)}
                            disabled={isInOutbound}
                            onChange={(e) => {
                              if (e.target.checked) setReturnOrderIds([...returnOrderIds, order.id])
                              else setReturnOrderIds(returnOrderIds.filter((id) => id !== order.id))
                            }}
                            className="rounded accent-orange-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{order.customerName}</p>
                            {order.operationNumber && (
                              <p className="text-xs text-orange-600">Op. {order.operationNumber}</p>
                            )}
                            <p className="text-xs text-gray-500 truncate">{order.endAddress || order.address}</p>
                          </div>
                          <span className="text-xs text-gray-500 shrink-0">{order.weight} kg</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={resetModal}
                  className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateRoute}
                  disabled={
                    !routeName.trim() ||
                    !originPoint ||
                    (outboundOrderIds.length === 0 && returnOrderIds.length === 0) ||
                    createRoute.isPending
                  }
                  className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {createRoute.isPending ? 'Creando...' : 'Crear Ruta'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
