'use client'

import Navbar from '@/components/Navbar'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md p-6 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { token } = useAppStore()

  const { data: stats } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await axios.get('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.data
    },
    enabled: !!token
  })

  return (
    <div className="flex flex-col">
      <Navbar title="Dashboard" />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard label="Total Orders" value={stats?.totalOrders || 0} icon="📦" color="border-blue-500" />
          <StatCard label="Delivered" value={stats?.deliveredOrders || 0} icon="✅" color="border-green-500" />
          <StatCard label="Total Distance" value={`${(stats?.totalDistance || 0).toFixed(1)} km`} icon="🗺️" color="border-yellow-500" />
          <StatCard label="Total Revenue" value={`$${(stats?.totalRevenue || 0).toFixed(2)}`} icon="💰" color="border-purple-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="font-bold text-gray-800 mb-4">📊 Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Total Routes</span>
                <span className="font-semibold">{stats?.totalRoutes || 0}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Pending Orders</span>
                <span className="font-semibold text-yellow-600">{stats?.pendingOrders || 0}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Delivery Rate</span>
                <span className="font-semibold text-green-600">
                  {stats?.totalOrders
                    ? `${Math.round((stats.deliveredOrders / stats.totalOrders) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="font-bold text-gray-800 mb-4">🚀 Quick Actions</h3>
            <div className="space-y-3">
              <a href="/orders" className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                <span>📦</span>
                <span className="text-sm font-medium text-blue-700">Manage Orders</span>
              </a>
              <a href="/routes" className="flex items-center gap-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
                <span>🗺️</span>
                <span className="text-sm font-medium text-green-700">Plan Routes</span>
              </a>
              <a href="/settings" className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition-colors">
                <span>⚙️</span>
                <span className="text-sm font-medium text-yellow-700">Configure Pricing</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
