/**
 * Renders the FRAGMENT API welcome page served at the root route.
 *
 * Pure CSS, no external assets, no inline scripts — keeps the page CSP-safe
 * (only `style-src 'unsafe-inline'` is required, and that header is set by the
 * route handler itself, not globally).
 *
 * The visual language matches the platform: brutalist film-strip frame, cream
 * paper, hard ink borders, RGB-split glitch on the title.
 */
export const renderWelcomePage = (version: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>FRAGMENT API</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #0A0A0A;
    --paper: #F4F1EA;
    --paper-dim: #E8E3D7;
    --glitch-red: #FF3B30;
    --glitch-cyan: #00B7CB;
    --grain: rgba(10, 10, 10, 0.04);
  }

  html, body {
    min-height: 100vh;
    background: var(--paper);
    color: var(--ink);
    font-family: 'JetBrains Mono', 'IBM Plex Mono', 'Courier New', ui-monospace, monospace;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  body {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 20px;
    min-height: 100vh;
  }

  /* VHS scan lines — subtle horizontal bars across the whole viewport */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 2px,
      var(--grain) 2px,
      var(--grain) 3px
    );
    pointer-events: none;
    z-index: 1;
  }

  /* Corner crop marks — printer registration aesthetic */
  body::after {
    content: '';
    position: fixed;
    inset: 16px;
    border: 1px dashed rgba(10, 10, 10, 0.18);
    pointer-events: none;
    z-index: 1;
  }

  .container {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 720px;
    background: var(--paper);
    border: 2px solid var(--ink);
    box-shadow: 10px 10px 0 0 var(--ink);
    padding: 56px 40px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
  }

  /* Film-strip sprocket holes on top + bottom edges */
  .filmstrip {
    width: 100%;
    height: 22px;
    background:
      repeating-linear-gradient(
        to right,
        var(--ink) 0,
        var(--ink) 18px,
        var(--paper) 18px,
        var(--paper) 26px
      );
    border-top: 2px solid var(--ink);
    border-bottom: 2px solid var(--ink);
  }

  h1 {
    font-size: clamp(2.6rem, 8vw, 4.5rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 0.9;
    text-transform: uppercase;
    text-align: center;
    position: relative;
    color: var(--ink);
    text-shadow:
      2px 0 0 var(--glitch-red),
      -2px 0 0 var(--glitch-cyan);
  }

  h1::before {
    content: '[ ';
    color: var(--ink);
    text-shadow: none;
    font-weight: 400;
    opacity: 0.4;
  }

  h1::after {
    content: ' ]';
    color: var(--ink);
    text-shadow: none;
    font-weight: 400;
    opacity: 0.4;
  }

  .subtitle {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.32em;
    text-align: center;
    color: var(--ink);
    opacity: 0.6;
    border-top: 1px solid var(--ink);
    border-bottom: 1px solid var(--ink);
    padding: 8px 16px;
  }

  .version {
    font-size: 0.85rem;
    text-align: center;
    color: var(--ink);
    background: var(--paper-dim);
    border: 1px solid var(--ink);
    padding: 4px 12px;
    letter-spacing: 0.08em;
  }

  .version::before {
    content: '> BUILD ';
    opacity: 0.5;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    justify-content: center;
    margin-top: 8px;
  }

  .links a {
    display: inline-block;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    text-decoration: none;
    padding: 14px 22px;
    border: 2px solid var(--ink);
    transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--ink);
    color: var(--paper);
    box-shadow: 4px 4px 0 0 var(--glitch-red);
  }

  .btn-primary:hover {
    transform: translate(-3px, -3px);
    box-shadow: 7px 7px 0 0 var(--glitch-red);
  }

  .btn-secondary {
    background: var(--paper);
    color: var(--ink);
    box-shadow: 4px 4px 0 0 var(--ink);
  }

  .btn-secondary:hover {
    transform: translate(-3px, -3px);
    box-shadow: 7px 7px 0 0 var(--glitch-cyan);
    background: var(--paper-dim);
  }

  .btn-primary:focus-visible,
  .btn-secondary:focus-visible {
    outline: 3px solid var(--glitch-cyan);
    outline-offset: 3px;
  }

  .meta {
    width: 100%;
    margin-top: 8px;
    padding-top: 20px;
    border-top: 1px dashed var(--ink);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px 16px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    opacity: 0.7;
    text-align: center;
  }

  .meta span::before {
    content: '◉ ';
    color: var(--glitch-red);
  }

  .sign {
    position: relative;
    z-index: 2;
    margin-top: 28px;
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    text-align: center;
    color: var(--ink);
    opacity: 0.85;
  }

  .sign a {
    color: var(--ink);
    text-decoration: none;
    border-bottom: 1px solid var(--ink);
    padding-bottom: 1px;
    transition: color 0.12s ease, border-color 0.12s ease;
  }

  .sign a:hover {
    color: var(--glitch-red);
    border-color: var(--glitch-red);
  }

  .sign a:focus-visible {
    outline: 2px solid var(--glitch-cyan);
    outline-offset: 3px;
  }

  @media (max-width: 480px) {
    .container { padding: 36px 22px 28px; box-shadow: 6px 6px 0 0 var(--ink); }
    .links a { padding: 12px 16px; font-size: 0.78rem; letter-spacing: 0.12em; }
  }

  @media (prefers-reduced-motion: reduce) {
    .links a, .sign a { transition: none; }
    .btn-primary:hover, .btn-secondary:hover { transform: none; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="filmstrip" aria-hidden="true"></div>

    <h1>FRAGMENT</h1>
    <p class="subtitle">Video Streaming API · HLS Pipeline</p>
    <p class="version">v${version}</p>

    <nav class="links" aria-label="API navigation">
      <a href="/api/health" class="btn-primary">Health Check</a>
      <a href="/api/videos" class="btn-secondary">Videos Endpoint</a>
    </nav>

    <div class="meta" aria-label="Status">
      <span>Status Online</span>
      <span>Express 5</span>
      <span>HLS Ready</span>
    </div>

    <div class="filmstrip" aria-hidden="true"></div>
  </div>

  <footer class="sign">
    Created by
    <a href="https://serkanbayraktar.com/" target="_blank" rel="noopener noreferrer">Serkanby</a>
    |
    <a href="https://github.com/Serkanbyx" target="_blank" rel="noopener noreferrer">Github</a>
  </footer>
</body>
</html>`;
};
