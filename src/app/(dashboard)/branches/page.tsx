'use client'

import { useState } from 'react'
import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '@/components/Navbar'
import LocationInput, { LocationValue } from '@/components/LocationInput'
import { useAppStore } from '@/store/useAppStore'
import { useT } from '@/lib/i18n'
import { Icon } from '@iconify/react'

interface Branch {
  id: string
  name: string
  address?: string | null
  lat: number
  lng: number
  areaKm2: number
  _count?: { members: number }
}

const emptyLoc: LocationValue = { address: '', lat: null, lng: null }

export default function BranchesPage() {
  const { token, user } = useAppStore()
  const t = useT()
  const queryClient = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [name, setName] = useState('')
  const [area, setArea] = useState('1')
  const [loc, setLoc] = useState<LocationValue>(emptyLoc)

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await axios.get('/api/branches', { headers: { Authorization: `Bearer ${token}` } })
      return res.data as Branch[]
    },
    enabled: !!token && user?.role === 'admin',
  })

  const saveBranch = useMutation({
    mutationFn: async () => {
      const payload = { name, address: loc.address, lat: loc.lat, lng: loc.lng, areaKm2: parseFloat(area) || 1 }
      if (editing) {
        const res = await axios.patch(`/api/branches/${editing.id}`, payload, { headers: { Authorization: `Bearer ${token}` } })
        return res.data
      }
      const res = await axios.post('/api/branches', payload, { headers: { Authorization: `Bearer ${token}` } })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      close()
    },
  })

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/branches/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
  })

  const close = () => {
    setShowModal(false)
    setEditing(null)
    setName('')
    setArea('1')
    setLoc(emptyLoc)
  }

  const openCreate = () => {
    close()
    setShowModal(true)
  }

  const openEdit = (b: Branch) => {
    setEditing(b)
    setName(b.name)
    setArea(String(b.areaKm2))
    setLoc({ address: b.address || '', lat: b.lat, lng: b.lng })
    setShowModal(true)
  }

  const canSave = name.trim() !== '' && loc.lat != null && loc.lng != null

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col">
        <Navbar title={t('br.title')} />
        <div className="p-6">
          <div className="bg-white rounded-2xl p-6 shadow-md text-red-600 text-sm">{t('br.noPermission')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Navbar title={t('br.title')} />
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">{t('br.subtitle')}</p>
          <button onClick={openCreate} className="bg-primary text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700">
            {t('br.new')}
          </button>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-md p-12 text-center text-gray-500">{t('br.loading')}</div>
        ) : branches.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-12 text-center text-gray-500">{t('br.empty')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl shadow-md p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-800 truncate flex items-center gap-1">
                      <Icon icon="mdi:office-building-marker-outline" className="text-primary" />{b.name}
                    </h3>
                    {b.address && <p className="text-xs text-gray-500 truncate mt-0.5">{b.address}</p>}
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{b.lat.toFixed(4)}, {b.lng.toFixed(4)}</p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full shrink-0 font-mono font-semibold">{b.areaKm2} km²</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">{t('br.members', { n: b._count?.members ?? 0 })}</span>
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(b)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <Icon icon="mdi:pencil-outline" />{t('common.edit')}
                    </button>
                    <button onClick={() => deleteBranch.mutate(b.id)} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                      <Icon icon="mdi:trash-can-outline" />{t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close() }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{editing ? t('br.editTitle') : t('br.createTitle')}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('br.name')}</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('br.area')}</label>
                  <input type="number" step="0.1" min="0.1" value={area} onChange={(e) => setArea(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              </div>
              <LocationInput value={loc} onChange={setLoc} label={t('br.location')} markerColor="#16a34a" />
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={close} className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-gray-50">{t('common.cancel')}</button>
                <button onClick={() => saveBranch.mutate()} disabled={!canSave || saveBranch.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
                  {editing ? t('common.update') : t('common.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
