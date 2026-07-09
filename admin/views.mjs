import { escapeHtml } from "./lib.mjs";

const STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 780px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; line-height: 1.5; }
  h1, h2, h3 { line-height: 1.25; }
  header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.5rem; border-bottom: 1px solid #8884; padding-bottom: 0.75rem; }
  header a { text-decoration: none; }
  fieldset { border: 1px solid #8884; border-radius: 8px; margin-bottom: 1.5rem; padding: 1rem 1.25rem 1.25rem; }
  legend { font-weight: 600; padding: 0 0.4rem; }
  label { display: block; margin-top: 0.6rem; font-size: 0.9rem; }
  input, select, textarea { width: 100%; padding: 0.4rem 0.5rem; margin-top: 0.2rem; box-sizing: border-box; font-size: 0.95rem; }
  button { margin-top: 0.9rem; padding: 0.5rem 1rem; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 1rem; }
  th, td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid #8883; }
  .msg { padding: 0.6rem 0.9rem; border-radius: 6px; margin-bottom: 1rem; }
  .msg.success { background: #d7f0d7; color: #205020; }
  .msg.error { background: #f6d6d6; color: #6a1f1f; }
  .muted { opacity: 0.7; font-size: 0.85rem; }
  .row { display: flex; gap: 0.75rem; }
  .row > * { flex: 1; }
  .danger { background: #c0392b; color: white; border: none; border-radius: 6px; }
  .vehicle-list a { display: block; padding: 0.6rem 0; border-bottom: 1px solid #8883; text-decoration: none; }
`;

export function layout(title, body, msg) {
  const msgHtml = msg
    ? `<div class="msg ${msg.type}">${escapeHtml(msg.text)}</div>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · Garage Log Admin</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <a href="/"><strong>🔧 Garage Log Admin</strong></a>
  <span class="muted">local only — not deployed</span>
</header>
${msgHtml}
${body}
</body>
</html>`;
}

export function msgFromQuery(query) {
  if (!query.msg) return null;
  return { text: query.msg, type: query.type === "error" ? "error" : "success" };
}
