import { createFileRoute } from "@tanstack/react-router";
import SpainPage from "@/features/spain/SpainPage";

export const Route = createFileRoute("/spain")({
  head: () => ({
    meta: [
      { title: "España — Orbita" },
      {
        name: "description",
        content:
          "Aprende la geografía de España: comunidades autónomas y provincias en el globo 3D.",
      },
    ],
  }),
  component: SpainPage,
});
