'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import OrderTable from '@/components/OrderTable'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@iconify/react'
import { haversineDistance, calculateOrderPrice } from '@/lib/pricing'

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false })

interface OrderFormData {
  customerName: string
  address: string
  startAddress: string
  endAddress: string
  startLat: string
  startLng: string
  endLat: string
  endLng: string
  weight: string
  notes: string
  vehicleIds: string[]
}

interface Vehicle {
  id: string
  name: string
  type: string
  plate: string | null
  capacity: number
  status: string
  baseFee: number
  costPerKm: number
  costPerKg: number
}

interface Order {
  id: string
  customerName: string
  address: string
  weight: number
  status: string
  price?: number | null
  createdAt: string
  startAddress?: string | null
  endAddress?: string | null
  startLat?: number | null
  startLng?: number | null
  endLat?: number | null
  endLng?: number | null
  lat?: number | null
  lng?: number | null
  notes?: string | null
  vehicleId?: string | null
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

const defaultForm: OrderFormData = {
  customerName: '',
  address: '',
  startAddress: '',
  endAddress: '',
  startLat: '',
  startLng: '',
  endLat: '',
  endLng: '',
  weight: '1',
  notes: '',
  vehicleIds: [],
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`,
      { headers: { 'User-Agent': 'ProCovarDelivery/1.0' } }
    )
    const data = await res.json() as { display_name?: string }
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

async function forwardGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (query.trim().length < 6) return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=es`,
      { headers: { 'User-Agent': 'ProCovarDelivery/1.0' } }
    )
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    return null
  } catch {
    return null
  }
}

export default function OrdersPage() {
  const { token } = useAppStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [form, setForm] = useState<OrderFormData>(defaultForm)
  const [mapTarget, setMapTarget] = useState<'start' | 'end'>('end')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedOrderForMap, setSelectedOrderForMap] = useState<Order | null>(null)
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const startAddrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endAddrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await axios.get('/api/vehicles', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    enabled: !!token
  })

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await axios.get('/api/orders', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    enabled: !!token
  })

  const createMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const res = await axios.post('/api/orders', data, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setShowModal(false)
      setForm(defaultForm)
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      const res = await axios.patch(`/api/orders/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setShowModal(false)
      setEditingOrder(null)
      setForm(defaultForm)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      customerName: form.customerName,
      address: form.address,
      startAddress: form.startAddress || null,
      endAddress: form.endAddress || null,
      startLat: form.startLat ? parseFloat(form.startLat) : null,
      startLng: form.startLng ? parseFloat(form.startLng) : null,
      endLat: form.endLat ? parseFloat(form.endLat) : null,
      endLng: form.endLng ? parseFloat(form.endLng) : null,
      lat: form.endLat ? parseFloat(form.endLat) : null,
      lng: form.endLng ? parseFloat(form.endLng) : null,
      weight: parseFloat(form.weight) || 1,
      notes: form.notes || null,
      vehicleIds: form.vehicleIds,
    }

    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (order: Order) => {
    setEditingOrder(order)
    setForm({
      customerName: order.customerName,
      address: order.address,
      startAddress: order.startAddress || '',
      endAddress: order.endAddress || '',
      startLat: order.startLat?.toString() || '',
      startLng: order.startLng?.toString() || '',
      endLat: (order.endLat ?? order.lat)?.toString() || '',
      endLng: (order.endLng ?? order.lng)?.toString() || '',
      weight: order.weight?.toString() || '1',
      notes: order.notes || '',
      vehicleIds: order.vehicleAssignments?.map((assignment) => assignment.vehicleId) || (order.vehicleId ? [order.vehicleId] : []),
    })
    setShowModal(true)
  }

  // Forward geocode: when address is typed → update lat/lng → map updates automatically
  useEffect(() => {
    if (startAddrTimer.current) clearTimeout(startAddrTimer.current)
    if (!form.startAddress || form.startAddress.length < 6) return
    startAddrTimer.current = setTimeout(async () => {
      const coords = await forwardGeocode(form.startAddress)
      if (coords) {
        setForm((prev) => ({
          ...prev,
          startLat: coords.lat.toFixed(6),
          startLng: coords.lng.toFixed(6),
        }))
      }
    }, 800)
    return () => { if (startAddrTimer.current) clearTimeout(startAddrTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startAddress])

  useEffect(() => {
    if (endAddrTimer.current) clearTimeout(endAddrTimer.current)
    if (!form.endAddress || form.endAddress.length < 6) return
    endAddrTimer.current = setTimeout(async () => {
      const coords = await forwardGeocode(form.endAddress)
      if (coords) {
        setForm((prev) => ({
          ...prev,
          endLat: coords.lat.toFixed(6),
          endLng: coords.lng.toFixed(6),
          address: prev.address || prev.endAddress,
        }))
      }
    }, 800)
    return () => { if (endAddrTimer.current) clearTimeout(endAddrTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.endAddress])

  useEffect(() => {
    if (!form.startLat || !form.startLng || !form.endLat || !form.endLng || form.vehicleIds.length === 0) {
      setEstimatedPrice(null)
      return
    }
    const vehicle = (vehicles as Vehicle[]).find((v) => v.id === form.vehicleIds[0])
    if (!vehicle) { setEstimatedPrice(null); return }
    const distKm = haversineDistance(
      parseFloat(form.startLat), parseFloat(form.startLng),
      parseFloat(form.endLat), parseFloat(form.endLng)
    )
    const price = calculateOrderPrice(distKm, parseFloat(form.weight) || 1, {
      baseFee: vehicle.baseFee,
      costPerKm: vehicle.costPerKm,
      costPerKg: vehicle.costPerKg,
    })
    setEstimatedPrice(price)
  }, [form.startLat, form.startLng, form.endLat, form.endLng, form.vehicleIds, form.weight, vehicles])

  const filteredOrders = orders.filter((o: Order) => {
    const matchSearch = !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.address.toLowerCase().includes(search.toLowerCase()) ||
      (o.startAddress || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.endAddress || '').toLowerCase().includes(search.toLowerCase())
    const matchDate = !dateFilter || o.createdAt.slice(0, 10) === dateFilter
    return matchSearch && matchDate
  })

  const mapStops = [
    form.startLat && form.startLng
      ? {
        id: 'start',
        lat: parseFloat(form.startLat),
        lng: parseFloat(form.startLng),
        label: 'Punto de origen',
        stopType: 'start' as const,
      }
      : null,
    form.endLat && form.endLng
      ? {
        id: 'end',
        lat: parseFloat(form.endLat),
        lng: parseFloat(form.endLng),
        label: 'Punto de destino',
        stopType: 'end' as const,
      }
      : null,
  ].filter((v): v is { id: string; lat: number; lng: number; label: string; stopType: 'start' | 'end' } => !!v)

  const selectedMapPoint = mapTarget === 'start'
    ? (form.startLat && form.startLng ? { lat: parseFloat(form.startLat), lng: parseFloat(form.startLng) } : null)
    : (form.endLat && form.endLng ? { lat: parseFloat(form.endLat), lng: parseFloat(form.endLng) } : null)

  return (
    <div className="flex flex-col">
      <Navbar title="Órdenes" />
      <div className="p-6">
        <div className="flex flex-wrap gap-3 items-center mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Buscar por cliente, dirección..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Icon icon="mdi:calendar-outline" className="text-gray-400 text-lg" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-gray-400 hover:text-gray-600"
                title="Limpiar filtro de fecha"
              >
                <Icon icon="mdi:close-circle" className="text-lg" />
              </button>
            )}
          </div>
          <button
            onClick={() => { setEditingOrder(null); setForm(defaultForm); setShowModal(true) }}
            className="bg-primary text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Icon icon="mdi:plus" className="text-lg" /> Nueva Orden
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-md">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Cargando órdenes...</div>
          ) : (
            <OrderTable
              orders={filteredOrders}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onViewMap={(order) => setSelectedOrderForMap(order as Order)}
            />
          )}
        </div>

      </div>

      {/* Modal de mapa de ruta */}
      {selectedOrderForMap && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrderForMap(null) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                <Icon icon="mdi:map-marker-path" className="text-primary text-xl" />
                Ruta · {selectedOrderForMap.customerName}
              </h3>
              <button onClick={() => setSelectedOrderForMap(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <Icon icon="mdi:close" className="text-2xl" />
              </button>
            </div>
            <div className="p-5">
              {(selectedOrderForMap.startLat && selectedOrderForMap.endLat) || (selectedOrderForMap.lat && selectedOrderForMap.lng) ? (
                <>
                  <MapComponent
                    stops={[
                      selectedOrderForMap.startLat && selectedOrderForMap.startLng
                        ? { id: 'start', lat: selectedOrderForMap.startLat!, lng: selectedOrderForMap.startLng!, label: `Origen: ${selectedOrderForMap.startAddress || 'Punto de inicio'}`, stopType: 'start' as const }
                        : null,
                      { id: 'end', lat: (selectedOrderForMap.endLat ?? selectedOrderForMap.lat)!, lng: (selectedOrderForMap.endLng ?? selectedOrderForMap.lng)!, label: `Destino: ${selectedOrderForMap.endAddress || selectedOrderForMap.address}`, stopType: 'end' as const },
                    ].filter((s): s is { id: string; lat: number; lng: number; label: string; stopType: 'start' | 'end' } => !!s)}
                  />
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center">A</span>
                        <p className="text-xs text-gray-500">Origen</p>
                      </div>
                      <p className="text-sm font-medium">{selectedOrderForMap.startAddress || 'No especificado'}</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">B</span>
                        <p className="text-xs text-gray-500">Destino</p>
                      </div>
                      <p className="text-sm font-medium">{selectedOrderForMap.endAddress || selectedOrderForMap.address}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Peso</p>
                      <p className="text-sm font-semibold">{selectedOrderForMap.weight} kg</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Precio transporte</p>
                      <p className="text-sm font-semibold text-blue-700">
                        {selectedOrderForMap.price != null ? `$${selectedOrderForMap.price.toFixed(2)}` : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-40 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                  Esta orden no tiene coordenadas GPS
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setEditingOrder(null); setForm(defaultForm) } }}
        >
          <div className="bg-white rounded-2xl p-8 w-full max-w-4xl shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingOrder ? 'Editar Orden' : 'Nueva Orden'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Referencia</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Referencia para despacho"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Origen (opcional)</label>
                  <input
                    type="text"
                    value={form.startAddress}
                    onChange={(e) => setForm({ ...form, startAddress: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Almacén / punto de recogida"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Destino (opcional)</label>
                  <input
                    type="text"
                    value={form.endAddress}
                    onChange={(e) => setForm({ ...form, endAddress: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Destino / punto de entrega"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lat. Origen</label>
                  <input
                    type="number"
                    step="any"
                    value={form.startLat}
                    onChange={(e) => setForm({ ...form, startLat: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-23.5505"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lng. Origen</label>
                  <input
                    type="number"
                    step="any"
                    value={form.startLng}
                    onChange={(e) => setForm({ ...form, startLng: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-46.6333"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lat. Destino</label>
                  <input
                    type="number"
                    step="any"
                    value={form.endLat}
                    onChange={(e) => setForm({ ...form, endLat: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-23.5505"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lng. Destino</label>
                  <input
                    type="number"
                    step="any"
                    value={form.endLng}
                    onChange={(e) => setForm({ ...form, endLng: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-46.6333"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1"><Icon icon="mdi:truck-outline" className="text-base" /> Asignar Vehículos (opcional)</span>
                </label>
                <div className="border rounded-xl max-h-36 overflow-y-auto">
                  {(vehicles as Vehicle[]).filter((v) => v.status !== 'maintenance').length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No hay vehículos disponibles</div>
                  ) : (
                    (vehicles as Vehicle[]).filter((v) => v.status !== 'maintenance').map((v) => (
                      <label key={v.id} className="flex items-center gap-2 p-2 border-b last:border-0 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.vehicleIds.includes(v.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, vehicleIds: [...form.vehicleIds, v.id] })
                            } else {
                              setForm({ ...form, vehicleIds: form.vehicleIds.filter((id) => id !== v.id) })
                            }
                          }}
                        />
                        <span className="text-sm text-gray-700">
                          {v.name}{v.plate ? ` (${v.plate})` : ''} · {v.capacity} kg · ${v.costPerKm}/km
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Si seleccionas varios vehículos, el primero será el principal.
                </p>
                {estimatedPrice !== null && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                    <Icon icon="mdi:calculator" className="text-blue-600 text-2xl flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">Precio estimado: ${estimatedPrice.toFixed(2)}</p>
                      <p className="text-xs text-blue-600">Distancia lineal · se recalcula con ruta real por carretera al guardar</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selector en Mapa</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMapTarget('start')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                      mapTarget === 'start' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-600 border-gray-200'
                    }`}
                  >
                    Seleccionar Origen
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapTarget('end')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                      mapTarget === 'end' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-gray-600 border-gray-200'
                    }`}
                  >
                    Seleccionar Destino
                  </button>
                  {geocoding && <span className="text-xs text-gray-400 italic self-center">Buscando dirección...</span>}
                </div>
                <div className="rounded-xl overflow-hidden border">
                  <MapComponent
                    stops={mapStops}
                    selectable
                    selectedPoint={selectedMapPoint}
                    onMapClick={async (point) => {
                      if (mapTarget === 'start') {
                        setForm((prev) => ({ ...prev, startLat: point.lat.toFixed(6), startLng: point.lng.toFixed(6) }))
                        setGeocoding(true)
                        const addr = await reverseGeocode(point.lat, point.lng)
                        setForm((prev) => ({ ...prev, startAddress: addr }))
                        setGeocoding(false)
                      } else {
                        setForm((prev) => ({ ...prev, endLat: point.lat.toFixed(6), endLng: point.lng.toFixed(6) }))
                        setGeocoding(true)
                        const addr = await reverseGeocode(point.lat, point.lng)
                        setForm((prev) => ({ ...prev, endAddress: addr, address: prev.address || addr }))
                        setGeocoding(false)
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Selecciona origen o destino, luego haz click en el mapa. También puedes escribir las coordenadas manualmente.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingOrder(null); setForm(defaultForm) }}
                  className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingOrder ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
