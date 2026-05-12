export const ROUTES = {
  home: '/',
  status: '/status',
} as const

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES]
