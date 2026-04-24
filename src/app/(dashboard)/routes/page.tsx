'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import RouteSummaryCard from '@/components/RouteSummaryCard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'

const MapComponent = dynamic(() => import('@/components/MapComponent'), { ssr: false })

interface RouteOrder {
  id: string
  customerName: string
  address: string
  status: string
  weight: number
  lat?: number | null
  lng?: number | null
  price?: number | null
  stopOrder?: number | null
}

interface Route {
  id: string
  name: string
  status: string
  totalDistance: number
  totalWeight: number
  totalPrice: number
  orders: RouteOrder[]
}

interface UnassignedOrder {
  id: string
  customerName: string
  address: string
  weight: number
  routeId?: string | null
}

export default function RoutesPage() {
  const { token } = useAppStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)

  const { data: routes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const res = await axios.get('/api/routes', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    enabled: !!token
  })

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-unassigned'],
    queryFn: async () => {
      const res = await axios.get('/api/orders', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data.filter((o: UnassignedOrder) => !o.routeId)
    },
    enabled: !!token
  })

  const createRoute = useMutation({
    mutationFn: async (data: unknown) => {
      const res = await axios.post('/api/routes', data, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    onSuccess: (data: Route) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['orders-unassigned'] })
      setShowModal(false)
      setRouteName('')
      setSelectedOrderIds([])
      setSelectedRoute(data)
    }
  })

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/routes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      queryClient.invalidateQueries({ queryKey: ['orders-unassigned'] })
      setSelectedRoute(null)
    }
  })

  const mapStops = selectedRoute?.orders
    ?.filter((o) => o.lat && o.lng)
    ?.sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0))
    ?.map((o) => ({
      id: o.id,
      lat: o.lat!,
      lng: o.lng!,
      label: o.customerName,
      status: o.status,
    })) || []

  return (
    <div className="flex flex-col">
      <Navbar title="Route Planner" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-700">Manage Routes</h3>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary text-white px-5 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            + Create Route
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            {routes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-500 shadow-md">
                No routes yet. Create your first route!
              </div>
            ) : (
              (routes as Route[]).map((route) => (
                <div key={route.id}>
                  <RouteSummaryCard
                    name={route.name}
                    status={route.status}
                    totalDistance={route.totalDistance}
                    totalWeight={route.totalWeight}
                    totalPrice={route.totalPrice}
                    orderCount={route.orders?.length || 0}
                    onClick={() => setSelectedRoute(route)}
                  />
                  <div className="flex gap-2 mt-2">
                    <a
                      href={`/driver/${route.id}`}
                      target="_blank"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Driver View →
                    </a>
                    <button
                      onClick={() => deleteRoute.mutate(route.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {selectedRoute ? (
              <>
                <div className="bg-white rounded-2xl shadow-md p-4">
                  <h3 className="font-bold text-gray-800 mb-3">
                    🗺️ {selectedRoute.name} Route Map
                  </h3>
                  {mapStops.length > 0 ? (
                    <MapComponent stops={mapStops} />
                  ) : (
                    <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                      No GPS coordinates available for this route
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-md p-4">
                  <h3 className="font-bold text-gray-800 mb-3">📋 Stops ({selectedRoute.orders?.length || 0})</h3>
                  <div className="space-y-2">
                    {selectedRoute.orders
                      ?.sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0))
                      ?.map((order, idx) => (
                        <div key={order.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {order.stopOrder || idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{order.customerName}</p>
                            <p className="text-xs text-gray-500">{order.address}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {order.status}
                          </span>
                          {order.price && (
                            <span className="text-xs font-medium text-gray-600">
                              ${order.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-md p-12 text-center text-gray-500">
                Select a route to view on the map
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Create New Route</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route Name</label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Morning Route"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Orders ({selectedOrderIds.length} selected)
                </label>
                <div className="max-h-64 overflow-y-auto border rounded-xl">
                  {(orders as UnassignedOrder[]).length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No unassigned orders available
                    </div>
                  ) : (
                    (orders as UnassignedOrder[]).map((order) => (
                      <label key={order.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(order.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderIds([...selectedOrderIds, order.id])
                            } else {
                              setSelectedOrderIds(selectedOrderIds.filter((id) => id !== order.id))
                            }
                          }}
                          className="rounded"
                        />
                        <div>
                          <p className="text-sm font-medium">{order.customerName}</p>
                          <p className="text-xs text-gray-500">{order.address}</p>
                        </div>
                        <span className="ml-auto text-xs text-gray-500">{order.weight} kg</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowModal(false); setRouteName(''); setSelectedOrderIds([]) }}
                  className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!routeName) return
                    createRoute.mutate({ name: routeName, orderIds: selectedOrderIds })
                  }}
                  disabled={!routeName || createRoute.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {createRoute.isPending ? 'Creating...' : 'Create Route'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
