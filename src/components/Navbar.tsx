'use client'

import { useAppStore } from '@/store/useAppStore'

export default function Navbar({ title }: { title: string }) {
  const { user } = useAppStore()

  return (
    <div className="h-16 bg-white border-b px-6 flex items-center justify-between shadow-sm">
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
          {user?.name?.[0] || 'U'}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{user?.name || 'User'}</p>
          <p className="text-xs text-gray-500">{user?.role || 'admin'}</p>
        </div>
      </div>
    </div>
  )
}
