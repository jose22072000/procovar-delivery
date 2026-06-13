'use client'

import { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { useT } from '@/lib/i18n'
import { Icon } from '@iconify/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser, setToken } = useAppStore()
  const t = useT()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await axios.post('/api/auth/login', { email, password })
      setToken(res.data.token)
      setUser(res.data.user)
      router.push('/dashboard')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || t('login.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* atmospheric gradient mesh */}
      <div className="pointer-events-none absolute inset-0 -z-0"
        style={{ background: 'radial-gradient(60% 50% at 15% 10%, rgba(31,79,224,0.10), transparent 70%), radial-gradient(55% 45% at 90% 90%, rgba(14,159,110,0.10), transparent 70%)' }} />
      <div className="relative z-10 w-full max-w-md animate-rise">
        <div className="text-center mb-7">
          <span className="inline-flex w-14 h-14 rounded-2xl bg-primary text-white items-center justify-center shadow-lg mb-4">
            <Icon icon="mdi:truck-fast" className="text-3xl" />
          </span>
          <h1 className="text-4xl font-extrabold text-ink tracking-tight">ProCovar</h1>
          <p className="text-ink-soft mt-2 text-sm">{t('login.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1.5">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-line rounded-xl bg-paper/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1.5">{t('login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-line rounded-xl bg-paper/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-colors font-mono"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-[#1840bd] transition-colors disabled:opacity-50 shadow-md"
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          <p className="text-center text-sm text-ink-soft/80 mt-6">
            {t('login.adminNote')}
          </p>
        </div>
      </div>
    </div>
  )
}
