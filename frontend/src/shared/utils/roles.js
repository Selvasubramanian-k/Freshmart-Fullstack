// Role -> home path. Pudhu role add panna inga add pannunga.
export const HOME_BY_ROLE = {
  customer: '/',
  admin: '/admin',
  delivery: '/delivery',
  superadmin: '/owner',
  picker: '/picker',
  support: '/support',
}

export const homeFor = (role) => HOME_BY_ROLE[role] || '/login'
