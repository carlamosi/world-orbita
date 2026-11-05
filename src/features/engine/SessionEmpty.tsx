import { Badge } from "@/components/ui/orbita-badge";
import { Button } from "@/components/ui/orbita-button";

interface Props {
  /** Starts an early-review session of already-seen cards. */
  onPractice: () => void;
  className?: string;
}

/**
 * Shown in place of the question when a quick-practice queue comes back empty
 * (nothing due, today's new-card limit reached). It renders inline, so the
 * page toolbar above it stays usable.
 */
export function SessionEmpty({ onPractice, className = "" }: Props) {
  return (
    <div
      role="status"
      className={`glass-strong rounded-3xl p-6 sm:p-8 max-w-md w-full mx-auto text-center border border-white/15 ${className}`}
    >
      <Badge tone="cyan">All caught up</Badge>
      <p className="mt-4 text-white/70 text-sm">
        Nothing is due and you've met today's new-card limit.
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={onPractice}>Practice anyway</Button>
      </div>
    </div>
  );
}
