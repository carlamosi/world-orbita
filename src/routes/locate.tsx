import { createFileRoute } from "@tanstack/react-router";
import LocatePage from "@/features/locate/LocatePage";

export const Route = createFileRoute("/locate")({
  head: () => ({
    meta: [
      { title: "Locate — Orbita" },
      {
        name: "description",
        content:
          "Find countries on the 3D globe or name highlighted countries to master world geography.",
      },
    ],
  }),
  component: LocatePage,
});
