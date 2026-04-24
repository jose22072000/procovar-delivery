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
  token: null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token)
      } else {
        localStorage.removeItem('token')
      }
    }
    set({ token })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
    }
    set({ user: null, token: null })
  },
}))

// Hydrate token from localStorage on client only
if (typeof window !== 'undefined') {
  const storedToken = localStorage.getItem('token')
  if (storedToken) {
    useAppStore.setState({ token: storedToken })
  }
}
