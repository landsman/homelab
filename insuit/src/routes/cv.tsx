import { createFileRoute } from "@tanstack/react-router";
import { CvPage } from "@/features/cv/cv-page";

export const Route = createFileRoute("/cv")({
  component: CvPage,
});
