export const ROUTES = {
  home: "/",
  contact: "/contact",
  cv: "/cv",
  // No route: the path the "nothing here" page is prerendered from, into the
  // 404.html Pages answers every unknown address with (src/server.ts).
  notFound: "/404",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
