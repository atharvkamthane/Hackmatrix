/**
 * HackMatrix Privacy & Suppression Architecture
 * Authoritative minimum group-size threshold K = 10
 */

export const MINIMUM_K_THRESHOLD = 10;

/**
 * Discriminated union for aggregate values enforcing strict privacy rules.
 * Values below K threshold (10) are returned with `suppressed: true` from backend.
 * Frontend MUST NEVER access hidden counts or convert suppressed states to 0.
 */
export type AggregateValue =
  | {
      suppressed: true;
      reason: 'BELOW_K_THRESHOLD' | string;
    }
  | {
      suppressed: false;
      count: number;
    };

export function isSuppressed(val: AggregateValue | undefined | null): boolean {
  if (!val) return true;
  return val.suppressed === true;
}

export function formatAggregateValue(
  val: AggregateValue | undefined | null,
  fallback = 'Suppressed for privacy'
): string {
  if (!val || val.suppressed) {
    return fallback;
  }
  return val.count.toLocaleString();
}

/**
 * Ensures safe numeric extraction only when unsuppressed.
 * Returns null if suppressed to prevent derived percentage/ranking bugs.
 */
export function safeUnsuppressedCount(val: AggregateValue | undefined | null): number | null {
  if (!val || val.suppressed) {
    return null;
  }
  return val.count;
}
