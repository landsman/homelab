import { createRouter } from "@tanstack/react-router";
import { NotFoundPage } from "@/features/not-found/not-found-page";
import { routeTree } from "@/routeTree.gen";

export const getRouter = () =>
  createRouter({
    routeTree,
    defaultNotFoundComponent: NotFoundPage,
    scrollRestoration: true,
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
