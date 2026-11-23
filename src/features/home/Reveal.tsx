import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { spring } from "@/lib/motion";

/** Unveils its content as it scrolls into view, once. Plain markup with reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 36, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ ...spring.soft, delay }}
    >
      {children}
    </motion.div>
  );
}
