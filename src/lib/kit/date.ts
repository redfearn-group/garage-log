/* CANONICAL. Authored in redfearn-group/redfearn-brand under kit/ and
   vendored into each Astro app by sync.mjs. Do not edit the copy in a
   consumer repo: the next sync overwrites it, and the vendor drift CI job
   fails the build first. */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format a YYYY-MM-DD string as "DD MMM YYYY" (e.g. "19 Jun 2023").
 * Returns the input unchanged if it isn't a plain YYYY-MM-DD date string.
 *
 * Parsed by regex rather than through `new Date(str)` on purpose. The Date
 * constructor reads a bare "2026-06-14" as UTC midnight and then renders it
 * in local time, which west of Greenwich prints the previous day. Every
 * date in these repos is a calendar date with no time component, so it
 * should never travel through a timezone at all. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const [, year, month, day] = match;
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}

/** Parse a YYYY-MM-DD string into a Date at LOCAL midnight, for date
 * arithmetic (intervals, due dates, age). Returns null if it isn't a plain
 * YYYY-MM-DD string. Same timezone reasoning as formatDate. */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Whole days from `from` to `to`, positive when `to` is later. Both are
 * YYYY-MM-DD strings. Returns null if either fails to parse. */
export function daysBetween(from: string, to: string): number | null {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Today as YYYY-MM-DD in local time. Use instead of slicing an ISO string
 * off `toISOString()`, which is UTC and rolls over at the wrong moment. */
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
