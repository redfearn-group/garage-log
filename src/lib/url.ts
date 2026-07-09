/** Prefix an absolute path with Astro's configured base (e.g. "/garage-log")
 * so internal links still work once deployed under a GitHub Pages project path. */
export function withBase(p: string): string {
  const base = import.meta.env.BASE_URL;
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedPath = p.startsWith("/") ? p : `/${p}`;
  return trimmedBase + trimmedPath;
}
