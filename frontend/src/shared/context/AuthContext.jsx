import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getToken, setToken, setUnauthorizedHandler } from '../api/client.js'

const AuthContext = createContext(null)


export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getToken()))

  const logout = useCallback(() => { clearToken(); setUser(null) }, [])

  // Page refresh -> token irundha /me la irundhu user ah load pannum
  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!getToken()) return
    api.get('/api/auth/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [logout])

  const login = useCallback(async (email, password, remember = true) => {
    const res = await api.post('/api/auth/login', { email, password })
    setToken(res.access_token, remember)
    setUser(res.user)
    return res.user
  }, [])

  // OTP login / sign-up reply ({ access_token, user }) -> logged in
  const signIn = useCallback((res) => {
    setToken(res.access_token, true)
    setUser(res.user)
    return res.user
  }, [])

  const updateProfile = useCallback(async (changes) => {
    const u = await api.put('/api/auth/me', changes)
    setUser(u)
    return u
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, signIn, logout, updateProfile }),
    [user, loading, login, signIn, logout, updateProfile]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
