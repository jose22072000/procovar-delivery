'use client'

import Sidebar from '@/components/Sidebar'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (!token) {
      router.push('/login')
    }
  }, [token, router])

  if (!token) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64 animate-rise">
        {children}
      </div>
    </div>
  )
}
