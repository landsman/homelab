import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/features/home/home-page";

// The home page's head is the root's (routes/__root.tsx).
export const Route = createFileRoute("/")({
  component: HomePage,
});
