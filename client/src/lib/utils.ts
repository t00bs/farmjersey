import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats an application ID and year into a human-readable reference number.
 * Example: year=2026, id=9 → "RSS-2026-0009"
 */
export function formatApplicationRef(year: number, id: number): string {
  const paddedId = id.toString().padStart(4, '0');
  return `RSS-${year}-${paddedId}`;
}
