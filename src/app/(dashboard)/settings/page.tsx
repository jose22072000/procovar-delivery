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
  const [saved, setSaved] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateSettings.mutate({
      baseFee: parseFloat(form.baseFee),
      costPerKm: parseFloat(form.costPerKm),
      costPerKg: parseFloat(form.costPerKg),
      currency: form.currency,
    })
  }

  return (
    <div className="flex flex-col">
      <Navbar title="Settings" />
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Icon icon="mdi:currency-usd" className="text-xl text-primary" /> Pricing Configuration</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Fee (per delivery)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.baseFee}
                    onChange={(e) => setForm({ ...form, baseFee: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Kilometer</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costPerKm}
                    onChange={(e) => setForm({ ...form, costPerKm: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Kilogram</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costPerKg}
                    onChange={(e) => setForm({ ...form, costPerKg: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="BRL">BRL - Brazilian Real</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </div>

              <div className="pt-2">
                {saved && (
                  <div className="bg-green-50 text-green-600 px-4 py-3 rounded-xl text-sm mb-3 flex items-center gap-2">
                    <Icon icon="mdi:check-circle" className="text-lg" /> Settings saved successfully!
                  </div>
                )}
                <button
                  type="submit"
                  disabled={updateSettings.isPending}
                  className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <PricingSummaryCard
              baseFee={parseFloat(form.baseFee) || 0}
              costPerKm={parseFloat(form.costPerKm) || 0}
              costPerKg={parseFloat(form.costPerKg) || 0}
              distanceKm={10}
              weightKg={5}
            />

            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Icon icon="mdi:function-variant" className="text-xl text-primary" /> Pricing Formula</h3>
              <div className="bg-gray-50 p-4 rounded-xl font-mono text-sm">
                <p className="text-gray-700">price = base_fee</p>
                <p className="text-gray-700">      + (distance_km × cost_per_km)</p>
                <p className="text-gray-700">      + (weight_kg × cost_per_kg)</p>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Example with 10km and 5kg: ${(
                  (parseFloat(form.baseFee) || 0) +
                  (parseFloat(form.costPerKm) || 0) * 10 +
                  (parseFloat(form.costPerKg) || 0) * 5
                ).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
