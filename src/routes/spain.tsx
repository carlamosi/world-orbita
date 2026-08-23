import { createFileRoute } from "@tanstack/react-router";
import SpainPage from "@/features/spain/SpainPage";

export const Route = createFileRoute("/spain")({
  head: () => ({
    meta: [
      { title: "Spain — Orbita" },
      {
        name: "description",
        content:
          "Master Spain's geography: 19 autonomous communities, 50 provinces, flags, and capitals on the 3D globe.",
      },
    ],
  }),
  component: SpainPage,
});
