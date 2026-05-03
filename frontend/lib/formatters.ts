import { format, parseISO } from 'date-fns';

/**
 * Converts a kobo integer to a formatted Naira string.
 * e.g. 123456 → "₦1,234.56"
 */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

/**
 * Formats an ISO date string or Date object to "25 Jan 2025".
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM yyyy');
}

/**
 * Formats an ISO datetime string to "25 Jan 2025, 2:45 PM".
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM yyyy, h:mm a');
}

/**
 * Normalises a Nigerian phone number to "+234 801 234 5678".
 * Accepts: 08012345678 | +2348012345678 | 2348012345678
 */
export function formatNigerianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  let national: string;
  if (digits.startsWith('234') && digits.length === 13) {
    national = digits.slice(3); // strip country code
  } else if (digits.startsWith('0') && digits.length === 11) {
    national = digits.slice(1); // strip leading 0
  } else {
    return phone; // return as-is if unrecognised format
  }

  // national is now 10 digits: 8012345678
  const part1 = national.slice(0, 3); // 801
  const part2 = national.slice(3, 6); // 234
  const part3 = national.slice(6);    // 5678
  return `+234 ${part1} ${part2} ${part3}`;
}

/**
 * Returns the first letter of each word in a name, uppercased, max 2 chars.
 * e.g. "Goodnews Stephen" → "GS", "Amaka" → "A"
 */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/**
 * Returns the current Nigerian academic session string.
 * Academic year starts in September.
 * e.g. called in Oct 2024 → "2024/2025", called in Jan 2025 → "2024/2025"
 */
export function getCurrentSession(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}

/**
 * Formats a term key to a display label.
 * e.g. 'first' → 'First Term'
 */
export function formatTerm(term: string): string {
  const map: Record<string, string> = {
    first: 'First Term',
    second: 'Second Term',
    third: 'Third Term',
  };
  return map[term.toLowerCase()] ?? term;
}

/**
 * Formats a role key for display.
 * e.g. 'super_admin' → 'Super Admin'
 */
export function formatRole(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Formats a student's full name: "First [Middle] Last"
 */
export function formatStudentName(
  firstName: string,
  lastName: string,
  middleName?: string,
): string {
  return [firstName, middleName, lastName].filter(Boolean).join(' ');
}

/**
 * Returns a relative time label for recent dates.
 * e.g. "2 hours ago", "Yesterday", or falls back to formatDate.
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
}
