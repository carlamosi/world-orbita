import { createFileRoute } from "@tanstack/react-router";
import FlagsPage from "@/features/flags/FlagsPage";

export const Route = createFileRoute("/flags")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Flags — Orbita" },
      { name: "description", content: "Master every flag: identify countries in Easy or Hard mode." },
    ],
  }),
  component: FlagsPage,
});
