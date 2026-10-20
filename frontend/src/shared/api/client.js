// ─────────────────────────────────────────────────────────────
//  Backend API client (FastAPI). Base URL -> frontend/.env la VITE_API_URL
//  Token: ovvoru TAB kum thani login (sessionStorage). So oray browser la
//  tab 1 customer, tab 2 admin, tab 3 rider nu test pannalam.
//  "Remember me" tick pannina localStorage la-um save aagum -> pudhu tab / browser
//  restart pannalum login irukkum. Ella request kum Authorization header add aagum.
// ─────────────────────────────────────────────────────────────
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

// /demo page la ovvoru frame kum (window.name = 'fm-demo-…') thani key
const scope = typeof window !== 'undefined' && window.name.startsWith('fm-demo-') ? `:${window.name}` : ''
const TOKEN_KEY = `freshmart_token${scope}`
const ss = () => window.sessionStorage
const ls = () => window.localStorage

export const getToken = () => {
  try {
    const t = ss().getItem(TOKEN_KEY)
    if (t) return t
    const remembered = ls().getItem(TOKEN_KEY)          // pudhu tab: remembered login ah edukkum
    if (remembered) ss().setItem(TOKEN_KEY, remembered)
    return remembered
  } catch { return null }
}
export const setToken = (t, remember = true) => {
  try {
    ss().setItem(TOKEN_KEY, t)
    if (remember) ls().setItem(TOKEN_KEY, t)
    else if (ls().getItem(TOKEN_KEY) === t) ls().removeItem(TOKEN_KEY)
  } catch { /* storage blocked */ }
}
export const clearToken = () => {
  try {
    const t = ss().getItem(TOKEN_KEY)
    ss().removeItem(TOKEN_KEY)
    if (t && ls().getItem(TOKEN_KEY) === t) ls().removeItem(TOKEN_KEY)   // vera tab login ah thodaadhu
  } catch { /* storage blocked */ }
}

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
