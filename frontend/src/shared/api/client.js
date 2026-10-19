// ─────────────────────────────────────────────────────────────
//  Backend API client (FastAPI). Base URL -> frontend/.env la VITE_API_URL
//  Token localStorage la save aagum, ella request kum Authorization header add aagum.
// ─────────────────────────────────────────────────────────────
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

const TOKEN_KEY = 'freshmart_token'
export const getToken   = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken   = (t) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* storage blocked */ } }
export const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* storage blocked */ } }

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

async function request(method, path, body, { isForm = false } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized()
    const detail = data?.detail
    const msg = typeof detail === 'string' ? detail : 'Something went wrong. Please try again.'
    throw new ApiError(msg, res.status)
  }
  return data
}

export const api = {
  get:    (p)    => request('GET', p),
  post:   (p, b) => request('POST', p, b ?? {}),
  put:    (p, b) => request('PUT', p, b),
  patch:  (p, b) => request('PATCH', p, b),
  del:    (p)    => request('DELETE', p),
  upload: (p, file) => { const f = new FormData(); f.append('file', file); return request('POST', p, f, { isForm: true }) },
}
