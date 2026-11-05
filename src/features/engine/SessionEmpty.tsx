import { Badge } from "@/components/ui/orbita-badge";
import { Button } from "@/components/ui/orbita-button";
import type { EmptyReason } from "./useSession";

interface Props {
  /** Why the queue is empty (store `emptyReason`). */
  reason: EmptyReason | null;
  /** Whether there are already-seen cards to practise (store `hasSeen`). */
  hasSeen: boolean;
  /** Starts an early-review session of already-seen cards. */
  onPractice: () => void;
  className?: string;
}

function bodyCopy(reason: EmptyReason | null, hasSeen: boolean): string {
  if (!hasSeen) return "Come back tomorrow for new cards.";
  if (reason === "seenAll") {
    return "You've seen everything here and nothing is due yet. Come back later.";
  }
  return "Nothing is due and you've met today's new-card limit.";
}

/**
 * Shown in place of the question when a quick-practice queue comes back empty.
 * It renders inline, so the page toolbar above it stays usable. "Practice
 * anyway" is only offered when there are seen cards to practise.
 */
export function SessionEmpty({ reason, hasSeen, onPractice, className = "" }: Props) {
  return (
    <div
      role="status"
      className={`glass-strong rounded-3xl p-6 sm:p-8 max-w-md w-full mx-auto text-center border border-white/15 ${className}`}
    >
      <Badge tone="cyan">All caught up</Badge>
      <p className="mt-4 text-white/70 text-sm">{bodyCopy(reason, hasSeen)}</p>
      {hasSeen && (
        <div className="mt-6 flex justify-center">
          <Button onClick={onPractice}>Practice anyway</Button>
        </div>
      )}
    </div>
  );
}
