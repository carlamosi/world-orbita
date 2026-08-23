import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import SpainPage from "@/features/spain/SpainPage";

const spainSearchSchema = z.object({
  skill: z.enum(["locate", "name", "flags", "capitals"]).optional(),
});

export const Route = createFileRoute("/spain")({
  validateSearch: (search) => spainSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Geography — Spain — Orbita" },
      {
        name: "description",
        content:
          "Master Spain's geography: 19 autonomous communities, 50 provinces, flags, and capitals on the 3D globe.",
      },
    ],
  }),
  component: SpainPage,
});
