'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'

const navItems = [
  { href: '/dashboard', icon: 'mdi:view-dashboard-outline', label: 'Dashboard' },
  { href: '/orders', icon: 'mdi:package-variant-closed', label: 'Órdenes' },
  { href: '/vehicles', icon: 'mdi:truck-outline', label: 'Vehículos' },
  { href: '/reports', icon: 'mdi:chart-bar', label: 'Reportes' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { logout, user } = useAppStore()
  const router = useRouter()

  const items = user?.role === 'admin'
    ? [...navItems, { href: '/users', icon: 'mdi:account-group-outline', label: 'Usuarios' }]
    : navItems

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="w-64 bg-white h-screen shadow-md flex flex-col fixed left-0 top-0 z-10">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Icon icon="mdi:truck-delivery" className="text-2xl" />
          ProCovar
        </h1>
        <p className="text-xs text-gray-500 mt-1">Delivery Platform</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-blue-50 text-primary'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon icon={item.icon} className="text-xl" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <Icon icon="mdi:logout" className="text-xl" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  )
}
