// Utility helper functions

/**
 * Format a date into a human-readable string.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Clamp a number within a min/max range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a simple unique ID.
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export const DEFAULT_PAGE_SIZE = 20;
