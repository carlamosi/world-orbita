import { createFileRoute } from "@tanstack/react-router";
import ReviewPage from "@/features/review/ReviewPage";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Due Today — Orbita" },
      {
        name: "description",
        content:
          "Review every card that is due today across flags, capitals, locations and names — all in one prioritised session.",
      },
    ],
  }),
  component: ReviewPage,
});
