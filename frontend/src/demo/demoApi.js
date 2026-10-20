// Demo view helpers (dev only): talks to the backend as each seeded demo user.
import { API_BASE } from '../shared/api/client.js'

export const DEMO_USERS = {
  customer: { email: 'customer@freshmart.com', password: 'customer123' },
  admin:    { email: 'admin@freshmart.com',    password: 'admin123' },
  delivery: { email: 'rider@freshmart.com',    password: 'rider123' },
}

const tokens = {}
async function raw(method, path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) { const e = new Error(typeof data?.detail === 'string' ? data.detail : `Request failed (${res.status})`); e.status = res.status; throw e }
  return data
}

export async function as(role, method, path, body) {
  if (!tokens[role]) tokens[role] = (await raw('POST', '/api/auth/login', DEMO_USERS[role])).access_token
  try { return await raw(method, path, body, tokens[role]) }
  catch (e) {
    if (e.status !== 401) throw e
    tokens[role] = (await raw('POST', '/api/auth/login', DEMO_USERS[role])).access_token
    return raw(method, path, body, tokens[role])
  }
}
export const publicGet = (path) => raw('GET', path)
