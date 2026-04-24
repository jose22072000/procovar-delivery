import { create } from 'zustand'

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface AppState {
  user: User | null
  token: string | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },
}))
