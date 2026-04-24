'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

interface Order {
  id: string
  customerName: string
  address: string
  weight: number
  status: string
  lat?: number | null
  lng?: number | null
  stopOrder?: number | null
  price?: number | null
  notes?: string | null
}

interface Route {
  id: string
  name: string
  status: string
  totalDistance: number
  orders: Order[]
}

export default function DriverPage({ params }: { params: { routeId: string } }) {
  const [route, setRoute] = useState<Route | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [deliveryError, setDeliveryError] = useState('')

  useEffect(() => {
    const t = localStorage.getItem('token') || ''
    setToken(t)

    const fetchRoute = async () => {
      try {
        const res = await axios.get(`/api/routes/${params.routeId}`, {
          headers: { Authorization: `Bearer ${t}` }
        })
        setRoute(res.data)
      } catch {
        setError('Route not found or access denied')
      } finally {
        setLoading(false)
      }
    }

    fetchRoute()
  }, [params.routeId])

  const markDelivered = async (orderId: string) => {
    try {
      await axios.patch(`/api/orders/${orderId}`, { status: 'delivered' }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setRoute((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === orderId ? { ...o, status: 'delivered' } : o
          )
        }
      })
    } catch {
      setDeliveryError('Failed to update delivery status. Please try again.')
      setTimeout(() => setDeliveryError(''), 4000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl">🚚</p>
          <p className="text-gray-500 mt-2">Loading route...</p>
        </div>
      </div>
    )
  }

  if (error || !route) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl">❌</p>
          <p className="text-red-500 mt-2">{error || 'Route not found'}</p>
        </div>
      </div>
    )
  }

  const sortedOrders = [...route.orders].sort(
    (a, b) => (a.stopOrder || 0) - (b.stopOrder || 0)
  )
  const delivered = sortedOrders.filter((o) => o.status === 'delivered').length
  const total = sortedOrders.length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">🚚 Driver View</h1>
            <p className="text-blue-100 text-sm">{route.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{delivered}/{total}</p>
            <p className="text-blue-100 text-xs">Delivered</p>
          </div>
        </div>
        <div className="mt-3 bg-blue-700 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all"
            style={{ width: `${total > 0 ? (delivered / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {deliveryError && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
            {deliveryError}
          </div>
        )}
        {sortedOrders.map((order, idx) => (
          <div
            key={order.id}
            className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${
              order.status === 'delivered' ? 'border-green-500 opacity-75' : 'border-primary'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {order.stopOrder || idx + 1}
                </span>
                <div>
                  <p className="font-semibold text-gray-800">{order.customerName}</p>
                  <p className="text-xs text-gray-500">{order.weight} kg</p>
                </div>
              </div>
              {order.price && (
                <span className="text-sm font-medium text-gray-600">${order.price.toFixed(2)}</span>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-3">{order.address}</p>

            {order.notes && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-lg mb-3">
                📝 {order.notes}
              </p>
            )}

            <div className="flex gap-2">
              {order.lat && order.lng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-xl text-sm font-medium text-center hover:bg-blue-100"
                >
                  🗺️ Navigate
                </a>
              )}

              {order.status !== 'delivered' ? (
                <button
                  onClick={() => markDelivered(order.id)}
                  className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-600"
                >
                  ✓ Mark Delivered
                </button>
              ) : (
                <div className="flex-1 bg-green-100 text-green-700 py-2 rounded-xl text-sm font-medium text-center">
                  ✅ Delivered
                </div>
              )}
            </div>
          </div>
        ))}

        {sortedOrders.length === 0 && (
          <div className="text-center py-12 text-gray-500">No stops in this route</div>
        )}
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Distance</span>
            <span className="font-semibold">{route.totalDistance.toFixed(1)} km</span>
          </div>
        </div>
      </div>
    </div>
  )
}
