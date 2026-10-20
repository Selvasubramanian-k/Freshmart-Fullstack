// Role -> dashboard path. Pudhu role add panna (delivery, super_admin, picker, support) inga add pannunga.
export const HOME_BY_ROLE = {
  customer: '/',
  admin: '/admin',
  delivery: '/delivery',
}

export const homeFor = (role) => HOME_BY_ROLE[role] || '/login'
