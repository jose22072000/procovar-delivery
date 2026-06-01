'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import PricingSummaryCard from '@/components/PricingSummaryCard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@iconify/react'

export default function SettingsPage() {
  const { token } = useAppStore()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    baseFee: '5.0',
    costPerKm: '1.5',
    costPerKg: '0.5',
    currency: 'USD',
  })
  const [cupRate, setCupRate] = useState('320')
  const [cupRateUpdatedAt, setCupRateUpdatedAt] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [cupSaved, setCupSaved] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await axios.get('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    enabled: !!token
  })

  useEffect(() => {
    if (settings) {
      setForm({
        baseFee: settings.baseFee.toString(),
        costPerKm: settings.costPerKm.toString(),
        costPerKg: settings.costPerKg.toString(),
        currency: settings.currency || 'USD',
      })
      setCupRate(settings.cupRate?.toString() ?? '320')
      setCupRateUpdatedAt(settings.cupRateUpdatedAt ?? null)
    }
  }, [settings])

  const updateSettings = useMutation({
    mutationFn: async (data: unknown) => {
      const res = await axios.put('/api/settings', data, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  })

  const updateCupRate = useMutation({
    mutationFn: async (rate: number) => {
      const res = await axios.put('/api/settings', { cupRate: rate }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setCupRateUpdatedAt(data.cupRateUpdatedAt)
      setCupSaved(true)
      setTimeout(() => setCupSaved(false), 3000)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateSettings.mutate({
      baseFee: parseFloat(form.baseFee),
      costPerKm: parseFloat(form.costPerKm),
      costPerKg: parseFloat(form.costPerKg),
      currency: form.currency,
    })
  }

  const handleCupRateSave = () => {
    const rate = parseFloat(cupRate)
    if (!isNaN(rate) && rate > 0) {
      updateCupRate.mutate(rate)
    }
  }

  const baseFee = parseFloat(form.baseFee) || 0
  const costPerKm = parseFloat(form.costPerKm) || 0
  const costPerKg = parseFloat(form.costPerKg) || 0
  const cupRateNum = parseFloat(cupRate) || 320
  const exampleKm = 10
  const exampleKg = 5
  const exampleUSD = baseFee + exampleKm * 2 * costPerKm + exampleKg * costPerKg
  const exampleCUP = exampleUSD * cupRateNum

  const formatCupDate = (iso: string | null) => {
    if (!iso) return 'nunca'
    const d = new Date(iso)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col">
      <Navbar title="Configuración" />
      <div className="p-6 space-y-6">

        {/* Tasa de cambio CUP — bloque prominente arriba */}
        <div className="bg-white rounded-2xl shadow-md p-6 border-l-4 border-yellow-400">
          <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
            <Icon icon="mdi:currency-usd" className="text-xl text-yellow-500" />
            Tasa de Cambio USD → CUP
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Actualizar a diario según el valor del mercado informal. Última actualización: <span className="font-medium">{formatCupDate(cupRateUpdatedAt)}</span>
          </p>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CUP por cada 1 USD
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">CUP</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={cupRate}
                  onChange={(e) => setCupRate(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCupRateSave() }}
                  className="w-full pl-14 pr-4 py-3 border-2 border-yellow-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-lg font-semibold"
                />
              </div>
            </div>
            <button
              onClick={handleCupRateSave}
              disabled={updateCupRate.isPending}
              className="px-5 py-3 bg-yellow-400 text-gray-900 rounded-xl font-semibold hover:bg-yellow-500 disabled:opacity-50 whitespace-nowrap"
            >
              {updateCupRate.isPending ? 'Guardando...' : 'Actualizar tasa'}
            </button>
          </div>

          {cupSaved && (
            <div className="mt-3 bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <Icon icon="mdi:check-circle" className="text-lg" /> Tasa actualizada correctamente
            </div>
          )}

          <div className="mt-4 bg-yellow-50 rounded-xl p-3 flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-xs text-gray-500">1 USD</p>
              <p className="font-bold text-gray-800 text-lg">$1.00</p>
            </div>
            <Icon icon="mdi:arrow-right-bold" className="text-yellow-500 text-xl shrink-0" />
            <div className="text-center">
              <p className="text-xs text-gray-500">Equivale a</p>
              <p className="font-bold text-yellow-700 text-lg">{cupRateNum.toLocaleString('es-ES')} CUP</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pricing config */}
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Icon icon="mdi:cog-outline" className="text-xl text-primary" />
              Configuración de Precios (USD)
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa base (por entrega)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.baseFee}
                    onChange={(e) => setForm({ ...form, baseFee: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costo por kilómetro
                  <span className="ml-1 text-xs text-gray-400">(se aplica ×2 por ida y vuelta)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.costPerKm}
                    onChange={(e) => setForm({ ...form, costPerKm: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo por kilogramo</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.costPerKg}
                    onChange={(e) => setForm({ ...form, costPerKg: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moneda base</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD - Dólar estadounidense</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="MLC">MLC - Moneda libremente convertible</option>
                </select>
              </div>

              <div className="pt-2">
                {saved && (
                  <div className="bg-green-50 text-green-600 px-4 py-3 rounded-xl text-sm mb-3 flex items-center gap-2">
                    <Icon icon="mdi:check-circle" className="text-lg" /> Configuración guardada
                  </div>
                )}
                <button
                  type="submit"
                  disabled={updateSettings.isPending}
                  className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateSettings.isPending ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <PricingSummaryCard
              baseFee={baseFee}
              costPerKm={costPerKm}
              costPerKg={costPerKg}
              distanceKm={exampleKm}
              weightKg={exampleKg}
            />

            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Icon icon="mdi:function-variant" className="text-xl text-primary" />
                Fórmula de cálculo por cliente
              </h3>
              <div className="bg-gray-50 p-4 rounded-xl font-mono text-sm space-y-1">
                <p className="text-gray-700">precio = tarifa_base</p>
                <p className="text-gray-700 pl-4">+ (dist_km_desde_origen <span className="font-bold text-blue-600">× 2</span> × costo_km)</p>
                <p className="text-gray-700 pl-4">+ (peso_kg × costo_kg)</p>
              </div>
              <div className="mt-3 bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Ejemplo con {exampleKm} km y {exampleKg} kg:</p>
                <p className="font-mono">
                  {baseFee.toFixed(2)} + ({exampleKm}×2×{costPerKm.toFixed(2)}) + ({exampleKg}×{costPerKg.toFixed(2)}) = <span className="font-bold">${exampleUSD.toFixed(2)} USD</span>
                </p>
                <p className="font-mono text-yellow-700">
                  ≈ <span className="font-bold">{Math.round(exampleCUP).toLocaleString('es-ES')} CUP</span> (a {cupRateNum} CUP/USD)
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                El <span className="font-semibold text-blue-600">×2</span> cubre ida y vuelta. Cada cliente paga según su distancia al punto de origen, no a la parada anterior.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
