'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@iconify/react'

interface Vehicle {
  id: string
  name: string
  type: string
  plate: string | null
  capacity: number
  baseFee: number
  costPerKm: number
  costPerKg: number
  status: string
  notes: string | null
  _count: { routes: number; orders: number }
}

interface VehicleFormData {
  name: string
  type: string
  plate: string
  capacity: string
  baseFee: string
  costPerKm: string
  costPerKg: string
  status: string
  notes: string
}

const defaultForm: VehicleFormData = {
  name: '',
  type: 'truck',
  plate: '',
  capacity: '1000',
  baseFee: '5.00',
  costPerKm: '1.50',
  costPerKg: '0.50',
  status: 'available',
  notes: '',
}

const vehicleTypes = [
  { value: 'truck', label: 'Camión', icon: 'mdi:truck' },
  { value: 'van', label: 'Furgoneta', icon: 'mdi:van-utility' },
  { value: 'motorcycle', label: 'Moto', icon: 'mdi:motorbike' },
  { value: 'car', label: 'Auto', icon: 'mdi:car' },
  { value: 'bicycle', label: 'Bicicleta', icon: 'mdi:bicycle' },
  { value: 'other', label: 'Otro', icon: 'mdi:truck-delivery' },
]

const statusConfig: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponible', color: 'bg-green-100 text-green-700' },
  in_use: { label: 'En uso', color: 'bg-blue-100 text-blue-700' },
  maintenance: { label: 'Mantenimiento', color: 'bg-yellow-100 text-yellow-700' },
}

function getTypeIcon(type: string) {
  return vehicleTypes.find((t) => t.value === type)?.icon || 'mdi:truck-delivery'
}

export default function VehiclesPage() {
  const { token } = useAppStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [form, setForm] = useState<VehicleFormData>(defaultForm)

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const res = await axios.get('/api/vehicles', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    enabled: !!token
  })

  const createMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const res = await axios.post('/api/vehicles', data, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      setShowModal(false)
      setForm(defaultForm)
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
      const res = await axios.patch(`/api/vehicles/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      setShowModal(false)
      setEditingVehicle(null)
      setForm(defaultForm)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/vehicles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      name: form.name,
      type: form.type,
      plate: form.plate || null,
      capacity: parseFloat(form.capacity) || 1000,
      baseFee: parseFloat(form.baseFee) || 5,
      costPerKm: parseFloat(form.costPerKm) || 1.5,
      costPerKg: parseFloat(form.costPerKg) || 0.5,
      status: form.status,
      notes: form.notes || null,
    }
    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setForm({
      name: vehicle.name,
      type: vehicle.type,
      plate: vehicle.plate || '',
      capacity: vehicle.capacity.toString(),
      baseFee: vehicle.baseFee.toString(),
      costPerKm: vehicle.costPerKm.toString(),
      costPerKg: vehicle.costPerKg.toString(),
      status: vehicle.status,
      notes: vehicle.notes || '',
    })
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingVehicle(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  return (
    <div className="flex flex-col">
      <Navbar title="Vehículos" />
      <div className="p-6">

        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-500 text-sm">Gestiona tu flota. Cada vehículo tiene sus propias tarifas para calcular el costo de las entregas.</p>
          <button
            onClick={openCreate}
            className="bg-primary text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icon icon="mdi:plus" className="text-lg" />
            Agregar Vehículo
          </button>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-md p-12 text-center text-gray-500">
            Cargando vehículos...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-16 text-center">
            <Icon icon="mdi:truck-outline" className="text-6xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Sin vehículos</p>
            <p className="text-gray-400 text-sm mt-1">Agrega tu primer vehículo para asignarlo a órdenes</p>
            <button
              onClick={openCreate}
              className="mt-4 bg-primary text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Agregar Vehículo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {(vehicles as Vehicle[]).map((vehicle) => (
              <div key={vehicle.id} className="bg-white rounded-2xl shadow-md p-5 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <Icon icon={getTypeIcon(vehicle.type)} className="text-2xl text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">{vehicle.name}</h3>
                      {vehicle.plate && (
                        <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded mt-0.5 inline-block">
                          {vehicle.plate}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusConfig[vehicle.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                    {statusConfig[vehicle.status]?.label || vehicle.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-xs text-gray-500">Tarifa base</p>
                    <p className="font-semibold text-sm text-gray-800">${vehicle.baseFee.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-xs text-gray-500">Por km</p>
                    <p className="font-semibold text-sm text-gray-800">${vehicle.costPerKm.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-xs text-gray-500">Por kg</p>
                    <p className="font-semibold text-sm text-gray-800">${vehicle.costPerKg.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Icon icon="mdi:weight" className="text-sm" />
                    {vehicle.capacity.toLocaleString()} kg capacidad
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon icon="mdi:map-marker-path" className="text-sm" />
                    {vehicle._count.routes} rutas
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon icon="mdi:package-variant-closed" className="text-sm" />
                    {vehicle._count.orders} órdenes
                  </span>
                </div>

                {vehicle.notes && (
                  <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg mb-3 line-clamp-2">{vehicle.notes}</p>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <button
                    onClick={() => handleEdit(vehicle)}
                    className="flex-1 flex items-center justify-center gap-1 text-sm text-blue-600 hover:bg-blue-50 py-2 rounded-xl transition-colors font-medium"
                  >
                    <Icon icon="mdi:pencil-outline" className="text-base" />
                    Editar
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(vehicle.id)}
                    className="flex-1 flex items-center justify-center gap-1 text-sm text-red-500 hover:bg-red-50 py-2 rounded-xl transition-colors font-medium"
                  >
                    <Icon icon="mdi:trash-can-outline" className="text-base" />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
              <Icon icon="mdi:truck-delivery" className="text-primary text-xl" />
              {editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Vehículo *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Camión #1, Furgoneta Azul"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {vehicleTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placa (opcional)</label>
                  <input
                    type="text"
                    value={form.plate}
                    onChange={(e) => setForm({ ...form, plate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    placeholder="ABC-1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad Máx. (kg)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="available">Disponible</option>
                    <option value="in_use">En uso</option>
                    <option value="maintenance">Mantenimiento</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                  <Icon icon="mdi:currency-usd" className="text-primary" />
                  Tarifas (usadas para calcular el costo de la entrega)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tarifa base ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.baseFee}
                      onChange={(e) => setForm({ ...form, baseFee: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Por km ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.costPerKm}
                      onChange={(e) => setForm({ ...form, costPerKm: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Por kg ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.costPerKg}
                      onChange={(e) => setForm({ ...form, costPerKg: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Información relevante del vehículo..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingVehicle(null); setForm(defaultForm) }}
                  className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 bg-primary text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingVehicle ? 'Actualizar' : 'Agregar Vehículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
