# FRAGMENT

> Brutalist, glitch-aesthetic video streaming platform.
> Creators upload raw video files that are transcoded server-side with FFmpeg into HLS (HTTP Live Streaming) and served as adaptive `.m3u8` playlists with `.ts` segments.

**Stack:** React 19 + Vite + TailwindCSS v4 (client) · Node 20 + Express 5 + Mongoose 9 + Multer + fluent-ffmpeg (server) · MongoDB Atlas (db).

---

## Repository Layout

```
fragment/
├── server/    # Express 5 API + FFmpeg HLS pipeline
├── client/    # React 19 + Vite + Tailwind v4 SPA
├── .gitignore
└── README.md
```

Each package is independent — install dependencies inside `server/` and `client/` separately.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | `>=20` | Required by both `server/` and `client/`. |
| npm | `>=10` | Ships with Node 20+. |
| MongoDB | Atlas free tier or local | Connection string read from `server/.env`. |
| FFmpeg + FFprobe | latest stable | **Required system binary** for HLS transcoding. See below. |

### FFmpeg System Requirement

`fluent-ffmpeg` is only a Node.js wrapper — the actual `ffmpeg` and `ffprobe`
binaries MUST be installed on the host operating system and reachable from
`PATH`. Without them, every upload will fail at the transcoding stage.

| OS | Install command |
|---|---|
| **Windows** | Download the static build from <https://ffmpeg.org/download.html>, extract it, and add the `bin/` folder to your system `PATH`. |
| **macOS** | `brew install ffmpeg` |
| **Linux / WSL** | `sudo apt update && sudo apt install ffmpeg` |
| **Fly.io (production)** | Installed inside the Docker image via `apt install ffmpeg` (see STEP 40 in `STEPS.md`). |

**Verification** — the following must print version info from any shell:

```bash
ffmpeg -version
ffprobe -version
```

---

## Local Development

### Server

```bash
cd server
npm install
npm run dev          # nodemon index.js
```

Useful scripts:

- `npm start` — production-style start (`node index.js`).
- `npm run seed:admin` — bootstrap the first admin user (covered in STEP 6).

### Client

```bash
cd client
npm install
npm run dev          # vite dev server
```

Useful scripts:

- `npm run build` — production bundle into `dist/`.
- `npm run preview` — serve the production build locally.
- `npm run lint` — run ESLint over the project.

---

## Security Defaults

- `.env` files are **never** committed — both root and nested `.env` paths are excluded by the root `.gitignore`.
- `server/uploads/` content is **never** committed — only `.gitkeep` placeholders are tracked.
- Production secrets (Mongo URI, JWT secret) are injected via Fly.io secrets, not files.

---

## Roadmap

The full step-by-step build guide lives in [`STEPS.md`](./STEPS.md).
The future migration plan from Fly.io's persistent volume to Backblaze B2 + Cloudflare CDN lives in [`MIGRATION-TO-B2.md`](./MIGRATION-TO-B2.md) — read it only after v1 is fully deployed.
