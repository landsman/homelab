import { createRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@/features/not-found/not-found-page";
import { routeTree } from "@/routeTree.gen";

export const getRouter = () =>
  createRouter({
    routeTree,
    defaultNotFoundComponent: NotFoundPage,
    scrollRestoration: true,
    // A page's code is fetched when a link to it is hovered or touched, so the
    // click that follows does not wait for it.
    defaultPreload: "intent",
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
