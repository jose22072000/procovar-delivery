'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import OrderTable from '@/components/OrderTable'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@iconify/react'

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false })

interface OrderFormData {
  operationNumber: string
  customerName: string
  address: string
  endAddress: string
  endLat: string
  endLng: string
  weight: string
  notes: string
}

interface Order {
  id: string
  customerName: string
  operationNumber?: string | null
  address: string
  weight: number
  status: string
  price?: number | null
  createdAt: string
  endAddress?: string | null
  endLat?: number | null
  endLng?: number | null
  lat?: number | null
  lng?: number | null
  notes?: string | null
  routeId?: string | null
}

const defaultForm: OrderFormData = {
  operationNumber: '',
  customerName: '',
  address: '',
  endAddress: '',
  endLat: '',
  endLng: '',
  weight: '1',
  notes: '',
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
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedOrderForMap, setSelectedOrderForMap] = useState<Order | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const endAddrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await axios.get('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      return res.data as { cupRate: number }
    },
    enabled: !!token,
  })
  const cupRate: number = settings?.cupRate ?? 320

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
      operationNumber: form.operationNumber || null,
      customerName: form.customerName,
      address: form.address || form.endAddress,
      endAddress: form.endAddress || null,
      endLat: form.endLat ? parseFloat(form.endLat) : null,
      endLng: form.endLng ? parseFloat(form.endLng) : null,
      lat: form.endLat ? parseFloat(form.endLat) : null,
      lng: form.endLng ? parseFloat(form.endLng) : null,
      weight: parseFloat(form.weight) || 1,
      notes: form.notes || null,
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
      operationNumber: order.operationNumber || '',
      customerName: order.customerName,
      address: order.address,
      endAddress: order.endAddress || '',
      endLat: (order.endLat ?? order.lat)?.toString() || '',
      endLng: (order.endLng ?? order.lng)?.toString() || '',
      weight: order.weight?.toString() || '1',
      notes: order.notes || '',
    })
    setShowModal(true)
  }

  // Auto-geocode when destination address is typed
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

  const filteredOrders = (orders as Order[]).filter((o) => {
    const matchSearch = !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.address.toLowerCase().includes(search.toLowerCase()) ||
      (o.operationNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.endAddress || '').toLowerCase().includes(search.toLowerCase())
    const matchDate = !dateFilter || o.createdAt.slice(0, 10) === dateFilter
    return matchSearch && matchDate
  })

  const mapStops = form.endLat && form.endLng
    ? [{
        id: 'end',
        lat: parseFloat(form.endLat),
        lng: parseFloat(form.endLng),
        label: 'Punto de destino',
        stopType: 'end' as const,
      }]
    : []

  return (
    <div className="flex flex-col">
      <Navbar title="Órdenes" />
      <div className="p-6">
        <div className="flex flex-wrap gap-3 items-center mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Buscar por cliente, Nº operación, dirección..."
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
              cupRate={cupRate}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onViewMap={(order) => setSelectedOrderForMap(order as Order)}
            />
          )}
        </div>
      </div>

      {/* Map view modal */}
      {selectedOrderForMap && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedOrderForMap(null) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="font-bold text-gray-800 text-lg">
                Ubicación · {selectedOrderForMap.customerName}
                {selectedOrderForMap.operationNumber && (
                  <span className="text-sm font-normal text-gray-500 ml-2">Op. {selectedOrderForMap.operationNumber}</span>
                )}
              </h3>
              <button onClick={() => setSelectedOrderForMap(null)} className="text-gray-400 hover:text-gray-600">
                <Icon icon="mdi:close" className="text-2xl" />
              </button>
            </div>
            <div className="p-5">
              {(selectedOrderForMap.endLat || selectedOrderForMap.lat) ? (
                <>
                  <MapComponent
                    stops={[{
                      id: 'dest',
                      lat: (selectedOrderForMap.endLat ?? selectedOrderForMap.lat)!,
                      lng: (selectedOrderForMap.endLng ?? selectedOrderForMap.lng)!,
                      label: selectedOrderForMap.endAddress || selectedOrderForMap.address,
                      stopType: 'end' as const,
                    }]}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Dirección</p>
                      <p className="text-sm font-medium">{selectedOrderForMap.endAddress || selectedOrderForMap.address}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Peso</p>
                      <p className="text-sm font-semibold">{selectedOrderForMap.weight} kg</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Precio</p>
                      <p className="text-sm font-semibold text-blue-700">
                        {selectedOrderForMap.price != null ? `$${selectedOrderForMap.price.toFixed(2)}` : 'Pendiente (se calcula al asignar ruta)'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Estado</p>
                      <p className="text-sm font-semibold">{selectedOrderForMap.status}</p>
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

      {/* Create/Edit modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); setEditingOrder(null); setForm(defaultForm) } }}
        >
          <div className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-xl max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingOrder ? 'Editar Orden' : 'Nueva Orden'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente *</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº Operación</label>
                  <input
                    type="text"
                    value={form.operationNumber}
                    onChange={(e) => setForm({ ...form, operationNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="OP-2024-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Destino</label>
                <input
                  type="text"
                  value={form.endAddress}
                  onChange={(e) => setForm({ ...form, endAddress: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Calle, número, ciudad..."
                />
                <p className="text-xs text-gray-500 mt-1">Las coordenadas se autocompletan al escribir.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitud</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitud</label>
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

              {/* Map picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selector en Mapa</label>
                {geocoding && <span className="text-xs text-gray-400 italic">Buscando dirección...</span>}
                <div className="rounded-xl overflow-hidden border mt-1">
                  <MapComponent
                    stops={mapStops}
                    selectable
                    selectedPoint={form.endLat && form.endLng ? { lat: parseFloat(form.endLat), lng: parseFloat(form.endLng) } : null}
                    onMapClick={async (point) => {
                      setForm((prev) => ({ ...prev, endLat: point.lat.toFixed(6), endLng: point.lng.toFixed(6) }))
                      setGeocoding(true)
                      const addr = await reverseGeocode(point.lat, point.lng)
                      setForm((prev) => ({ ...prev, endAddress: addr, address: prev.address || addr }))
                      setGeocoding(false)
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Haz click en el mapa para seleccionar la ubicación de destino.</p>
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

              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                💡 El precio se calculará automáticamente cuando la orden sea asignada a una ruta.
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
