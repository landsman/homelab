export const ROUTES = {
  home: "/",
  contact: "/contact",
  cv: "/cv",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
