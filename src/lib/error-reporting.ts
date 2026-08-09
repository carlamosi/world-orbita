/**
 * error-reporting.ts
 *
 * Lightweight error reporter. Logs to console in development.
 * In production, plug in Sentry or any other provider by replacing
 * the `captureException` implementation below.
 */

export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;

  const isDev = import.meta.env.DEV;

  if (isDev) {
    console.error("[Orbita Error]", error, context);
  }

  // Production: add Sentry.captureException or similar here
  // Sentry.captureException(error, { extra: context });
}
