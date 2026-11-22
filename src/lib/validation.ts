/**
 * Blueprint-synchronized input sanitization & volumetric guards.
 * All maxLength and regex patterns match firebase-blueprint.json & firestore.rules verbatim.
 */

export const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const DATE_ISO_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function sanitizeText(value: string, maxLen: number, fallback = ''): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

export function sanitizeOptionalText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function sanitizeCode(value: string, maxLen: number, fallback: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
  return cleaned.length >= 2 ? cleaned : fallback;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  const id = `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
  return id.slice(0, 64);
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRecentSchoolDates(count = 5): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(formatIsoDate(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates;
}

export function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
