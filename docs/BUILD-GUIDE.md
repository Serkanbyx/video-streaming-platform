# FRAGMENT — Step-by-Step Build Guide (TypeScript Edition)

> **Archived: original build playbook.**
> This is the 42-step roadmap I used to build FRAGMENT from scratch. The codebase
> has evolved since (zero-install Fly.io deploy via GitHub Actions, animated
> video previews, demo data seeded inside the release command, etc.), so treat
> this document as a *making-of* narrative rather than the canonical reference.
> For current architecture and setup instructions, see the project [README](../README.md).

---


> **Project Summary:**
> FRAGMENT is a brutalist, glitch-aesthetic video streaming platform where creators upload raw video files that are transcoded server-side with FFmpeg into HLS (HTTP Live Streaming) format, then served as adaptive `.m3u8` playlists with `.ts` segments. Three roles exist — `viewer` (browse, watch, like, comment, subscribe), `creator` (upload, manage own videos, see analytics), and `admin` (moderate users, videos, comments, view platform stats). Core features include FFmpeg-driven HLS transcoding with status polling, automatic thumbnail extraction, drag-and-drop upload with progress tracking, view counters with deduplication, nested comments, like/dislike, channel subscriptions, watch history, and a recommendation feed based on creator overlap. Security layers include JWT auth with role-based middleware, mass assignment protection, helmet/CORS hardening, separate rate limiters for auth/upload/global, MIME-whitelisted upload validation, ownership checks, and a custom NoSQL sanitization middleware compatible with Express 5. **The entire codebase is written in TypeScript** — strict mode, shared types between client and server via a `shared/` workspace, `tsx` for dev/runtime, `tsc` for production builds. Stack: React 19 + Vite + TailwindCSS v4 + React Player (HLS.js under the hood) on the client, Node 20 + Express 5 + Mongoose 8 + Multer + fluent-ffmpeg on the server, with MongoDB Atlas as the database.

> Each step below is a self-contained prompt. Execute them in order.
> Stack: React 19 + Vite, Node/Express 5, MongoDB/Mongoose 8, JWT, TailwindCSS v4, React Router v7, Axios, fluent-ffmpeg, React Player — **all in TypeScript** (strict mode, ESM, shared types).

---

## Design Manifesto — "Aykırı" Visual Language

FRAGMENT is intentionally hostile to the rounded, soft, pastel SaaS norm. The UI is a **brutalist + glitch** statement piece:

- **Typography:** Monospace as the primary voice (`JetBrains Mono`, `IBM Plex Mono`, `Space Grotesk` for display). Headings are oversized, ALL-CAPS, with negative letter-spacing. Numbers use tabular figures.
- **Color palette:** Cream/bone background `#F4F1EA`, ink black `#0A0A0A`, acid green `#B9FF66`, hot magenta `#FF2D87`, electric blue `#2D5BFF`, danger orange `#FF5B1F`. Dark mode flips to pure black `#000000` with phosphor green accents.
- **Borders:** 2px solid black on EVERY card, button, input, modal. Never rounded — hard 0px corners by default; on hover, components shift 2px down-right exposing a hard offset shadow (`box-shadow: 4px 4px 0 #0A0A0A`).
- **Layout:** Asymmetric CSS grids. Cards intentionally misaligned. Content reads like a printed zine — slashes (`//`), brackets (`[ ]`), pipes (`|`), and `-->` arrows decorate labels.
- **Motion:** Sparse, abrupt. Hover = instant offset, not animated easing. Page transitions = single-frame opacity flick. Loading uses ASCII spinners (`[|]` → `[/]` → `[-]` → `[\]`) and animated scanlines.
- **Glitch accents:** Hover on video cards triggers a 200ms RGB-split chromatic aberration. Section dividers use SVG noise patterns. The 404 page is a full-bleed glitch artifact.
- **Accessibility:** Despite the aggression, color contrast must hit WCAG AA (4.5:1). All glitch animations respect `prefers-reduced-motion`.

This manifesto is referenced in every client-facing step.

---

## TypeScript Conventions (Read Once, Apply Everywhere)

Every step in this guide assumes the following TS conventions. They are NOT repeated per step — internalize them now.

- **`strict: true`** in every `tsconfig.json`. Plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. No `any` unless explicitly justified with a `// @ts-expect-error` or a typed `unknown` cast.
- **ESM only.** `"type": "module"` in every `package.json`. All relative imports use the `.js` extension (yes, even in `.ts` source — TypeScript ESM resolution requires it: `import { foo } from './bar.js'`).
- **Module resolution:** `"moduleResolution": "NodeNext"` for server, `"bundler"` for client (Vite handles it).
- **File extensions:**
  - Server: `.ts` everywhere.
  - Client: `.tsx` for components/pages (anything with JSX), `.ts` for hooks/services/utils/contexts that don't render JSX directly.
- **Shared types** live in `shared/types/` at the repo root. Both `server` and `client` consume them via path alias `@shared/*`.
- **Mongoose models** export both the schema-inferred type (`InferSchemaType`) and the hydrated-document type (`HydratedDocument<T>`). Controllers use the hydrated form for instance methods.
- **Express handlers** are typed as `(req: Request<Params, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction) => Promise<void>`. Use generic Request to lock down `req.body`, `req.params`, `req.query`.
- **`req.user` augmentation:** every step that touches auth middleware assumes the global `Express.Request` interface is augmented to include `user: UserDoc | null` and `id: string`. Augmentation lives in `server/src/types/express.d.ts` (created in STEP 4).
- **Validation = Zod.** `express-validator` is replaced by `zod` schemas that double as runtime validators AND TypeScript types via `z.infer<typeof schema>`. The same Zod schema is shared with the client form via `shared/schemas/`.
- **API response shape** is uniform: `type ApiResponse<T> = { success: true; data: T } | { success: false; message: string; requestId?: string; errors?: ValidationError[] }`. Defined in `shared/types/api.ts`.
- **Dev runtime:** `tsx watch index.ts` (no transpile step, instant restart). Production: `tsc --build && node dist/index.js`.
- **No barrel files** (`index.ts` re-exports) — they break tree-shaking and slow down `tsc`. Import from the source file directly.
- **`as const`** on enum-like literal arrays (`['viewer','creator','admin'] as const`) so they become string-literal unions, not `string[]`.

---

## Table of Contents

**PHASE 0 — TypeScript Foundation (NEW)**
- STEP 0 — Repo Workspace, Shared Types & Root tsconfig

**PHASE 1 — Backend Foundation**
- STEP 1 — Project Scaffolding & Folder Structure
- STEP 2 — Server & Client Dependencies + FFmpeg System Requirement
- STEP 3 — Environment Configuration & Database Connection
- STEP 4 — Logging, Request ID, Express Augmentation & Sanitize Middleware
- STEP 5 — Rate Limiters & Hardened Server Entry
- STEP 6 — User Model, Auth System, Role Hierarchy & Admin Seed

**PHASE 2 — Backend Resources**
- STEP 7 — Video Model & Status State Machine
- STEP 8 — FFmpeg HLS Pipeline (Probe + Transcode + Thumbnail + Cleanup)
- STEP 9 — Multer Upload Route & Async Processing Trigger
- STEP 10 — Video Public CRUD: List, Detail, Search, Filter, Pagination
- STEP 11 — HLS Streaming Route & Range-Aware Static Serving
- STEP 12 — View Counter, Watch History & Deduplication
- STEP 13 — Likes / Dislikes System
- STEP 14 — Comments & Nested Replies
- STEP 15 — Channel Profile, Subscriptions & Recommendation Feed
- STEP 16 — User Profile & Preferences
- STEP 17 — Admin API: Dashboard, User & Video Moderation
- STEP 18 — Backend Validation, Sanitization & Security Audit

**PHASE 3 — Client Foundation**
- STEP 19 — Client Scaffolding: Vite, Tailwind v4, Axios, Custom Hooks, Contexts
- STEP 20 — Brutalist Design System: Tokens, Primitives, Glitch Effects
- STEP 21 — App Routing & Layout Shells
- STEP 22 — Brutalist Navbar & Footer
- STEP 23 — HTML Head, Open Graph & SEO Meta Tags

**PHASE 4 — Client Pages**
- STEP 24 — Auth Pages: Login & Register
- STEP 25 — Discovery Page: Asymmetric Video Grid with Search
- STEP 26 — Video Detail Page: HLS Player, Meta, Likes, Comments, Recommendations
- STEP 27 — Upload Page: Drag-Drop, Progress Bar, Processing Status Polling
- STEP 28 — Studio Dashboard: My Videos, Status Tabs, Edit/Delete
- STEP 29 — Channel Public Page: Creator Profile + Their Videos
- STEP 30 — User Profile, Watch History & Subscription Feed
- STEP 31 — Settings: Profile, Account, Appearance, Privacy, Notifications
- STEP 32 — Admin Panel: Dashboard, Users, Videos, Comments

**PHASE 5 — Polish & Deploy**
- STEP 33 — UX Enhancements: ASCII Loaders, Empty States, Toasts, Glitch Hover
- STEP 34 — 404 Glitch Page & Route Guard Refinements
- STEP 35 — README & Documentation
- STEP 36 — Code Cleanup & Pre-Deploy Review
- STEP 37 — Demo Seed Data: 14+ Pre-Populated Videos for Live Portfolio
- STEP 38 — Billing Safety Checklist & Fly.io Account Prep
- STEP 39 — MongoDB Atlas Setup
- STEP 40 — Backend Containerization (Dockerfile with TS build stage)
- STEP 41 — Fly.io Deploy: fly.toml, Volume, Secrets, First Deploy & Admin Seed
- STEP 42 — Frontend on Netlify & Maintenance Workflow

**Companion Documents (root of repo):**
- `docs/MIGRATION-TO-B2.md` — future migration guide from Fly.io persistent volume to Backblaze B2 + Cloudflare CDN. Read **only** when v1 is fully deployed and you outgrow the 3 GB volume. Not part of the v1 build.

---

## STEP 0 — Repo Workspace, Shared Types & Root tsconfig

Before any feature code, set up the TypeScript backbone that the rest of the build relies on. This is a small step but every later step assumes its existence.

### Root Workspace Layout

```
fragment/
├── shared/
│   ├── package.json                # name: "@fragment/shared", "type": "module"
│   ├── tsconfig.json               # composite: true, declaration: true
│   ├── types/
│   │   ├── api.ts                  # ApiResponse<T>, ApiError, PaginatedResponse<T>
│   │   ├── user.ts                 # UserRole, UserDTO, UserPreferences
│   │   ├── video.ts                # VideoStatus, VideoVisibility, VideoDTO
│   │   ├── comment.ts              # CommentDTO
│   │   ├── like.ts                 # LikeValue
│   │   └── admin.ts                # DiskUsageReport, CleanupReport
│   ├── schemas/
│   │   ├── auth.schema.ts          # zod schemas (register, login, changePassword)
│   │   ├── video.schema.ts         # zod (createVideo, updateVideo, listQuery, viewBody)
│   │   ├── comment.schema.ts
│   │   ├── user.schema.ts
│   │   └── admin.schema.ts
│   └── constants/
│       └── enums.ts                # USER_ROLES, VIDEO_STATUSES, etc. (as const)
├── server/                         # see STEP 1
├── client/                         # see STEP 1
├── tsconfig.base.json              # shared compiler options
├── package.json                    # workspaces: ["shared", "server", "client"]
├── .gitignore
└── README.md
```

### Root `package.json` (npm workspaces)

```json
{
  "name": "fragment",
  "private": true,
  "workspaces": ["shared", "server", "client"],
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "build:shared": "npm run build --workspace=@fragment/shared",
    "dev:server": "npm run dev --workspace=fragment-server",
    "dev:client": "npm run dev --workspace=fragment-client",
    "build": "npm run build:shared && npm run build --workspace=fragment-server && npm run build --workspace=fragment-client",
    "typecheck": "tsc --build"
  }
}
```

npm workspaces let `server` and `client` import `@fragment/shared` without symlink hacks — `npm install` at the root wires everything.

### `tsconfig.base.json` (root — shared compiler options)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "moduleDetection": "force",
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,

    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,

    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,

    "paths": {
      "@shared/*": ["./shared/*"]
    }
  }
}
```

Each workspace extends this and overrides only what's specific (DOM lib for client, NodeNext module for server, etc.).

### `shared/package.json`

```json
{
  "name": "@fragment/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./types/*": { "types": "./dist/types/*.d.ts", "default": "./dist/types/*.js" },
    "./schemas/*": { "types": "./dist/schemas/*.d.ts", "default": "./dist/schemas/*.js" },
    "./constants/*": { "types": "./dist/constants/*.d.ts", "default": "./dist/constants/*.js" }
  },
  "scripts": {
    "build": "tsc --build",
    "watch": "tsc --build --watch"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

### `shared/tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./"
  },
  "include": ["types/**/*.ts", "schemas/**/*.ts", "constants/**/*.ts"]
}
```

`composite: true` enables TypeScript project references — `server` and `client` declare a reference to `shared` and get incremental compilation for free.

### `shared/constants/enums.ts`

```ts
export const USER_ROLES = ['viewer', 'creator', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const VIDEO_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export type VideoStatus = typeof VIDEO_STATUSES[number];

export const VIDEO_VISIBILITIES = ['public', 'unlisted'] as const;
export type VideoVisibility = typeof VIDEO_VISIBILITIES[number];

export const LIKE_VALUES = [1, -1] as const;
export type LikeValue = typeof LIKE_VALUES[number];

export const SORT_OPTIONS = ['new', 'top', 'liked'] as const;
export type SortOption = typeof SORT_OPTIONS[number];
```

### `shared/types/api.ts`

```ts
export type ApiSuccess<T> = { success: true; data: T };

export type ValidationFieldError = { field: string; msg: string };

export type ApiFailure = {
  success: false;
  message: string;
  requestId?: string;
  errors?: ValidationFieldError[];
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
};
```

### `shared/types/user.ts`

```ts
import type { UserRole } from '../constants/enums.js';

export type UserPreferences = {
  theme: 'light' | 'dark' | 'system';
  accentColor: 'acid' | 'magenta' | 'electric' | 'orange';
  fontSize: 'sm' | 'md' | 'lg';
  density: 'compact' | 'comfortable';
  animations: 'full' | 'reduced' | 'off';
  scanlines: boolean;
  language: 'en';
  privacy: { showEmail: boolean; showHistory: boolean; showSubscriptions: boolean };
  notifications: { newSubscriber: boolean; newComment: boolean };
  content: { autoplay: boolean; defaultVolume: number };
};

export type UserDTO = {
  _id: string;
  username: string;
  email?: string;
  role: UserRole;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  totalViews: number;
  preferences: UserPreferences;
  isBanned: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicUserDTO = Pick<
  UserDTO,
  'username' | 'displayName' | 'bio' | 'bannerUrl' | 'subscriberCount' | 'videoCount' | 'totalViews' | 'createdAt'
>;

export type AuthResponse = { user: UserDTO; token: string };
```

### `shared/types/video.ts`

```ts
import type { VideoStatus, VideoVisibility } from '../constants/enums.js';
import type { PublicUserDTO } from './user.js';

export type VideoDTO = {
  _id: string;
  videoId: string;
  title: string;
  description: string;
  author: Pick<PublicUserDTO, 'username' | 'displayName' | 'subscriberCount'> & { _id: string };
  status: VideoStatus;
  hlsPath: string | null;
  thumbnailUrl: string | null;
  duration: number;
  views: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  tags: string[];
  visibility: VideoVisibility;
  isFlagged: boolean;
  processingError?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VideoStatusDTO = {
  videoId: string;
  status: VideoStatus;
  processingError: string | null;
};
```

### `shared/schemas/auth.schema.ts`

```ts
import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).regex(/[a-zA-Z]/).regex(/[0-9]/),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
```

Other `shared/schemas/*` files follow the same pattern and are introduced inline in the steps that consume them (e.g., video schemas in STEP 9, comment schemas in STEP 14).

**SECURITY:**
- The shared schema folder is the single source of truth for both server validation and client form types — drift is impossible.
- Constant arrays use `as const` so a typo like `VIDEO_STATUSES.includes('redy')` fails at compile time.
- No barrel `index.ts` re-exports — every consumer imports the exact file it needs, keeping the dependency graph explicit.

---

## STEP 1 — Project Scaffolding & Folder Structure

Create a monorepo with three top-level folders. This step is purely about the directory tree — actual dependency installation and the FFmpeg system requirement are covered in STEP 2.

**Root tree:**

```
fragment/
├── shared/                # see STEP 0
├── server/
├── client/
├── tsconfig.base.json
├── package.json           # npm workspaces root
├── .gitignore
└── README.md
```

**`server/` tree:**

```
server/
├── src/
│   ├── config/
│   │   ├── db.ts
│   │   └── env.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── video.controller.ts
│   │   ├── upload.controller.ts
│   │   ├── stream.controller.ts
│   │   ├── comment.controller.ts
│   │   ├── like.controller.ts
│   │   ├── subscription.controller.ts
│   │   ├── user.controller.ts
│   │   └── admin.controller.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── role.middleware.ts
│   │   ├── upload.middleware.ts
│   │   ├── sanitize.middleware.ts
│   │   ├── validate.middleware.ts
│   │   ├── rateLimiters.ts
│   │   ├── requestId.middleware.ts
│   │   ├── requestLogger.middleware.ts
│   │   └── error.middleware.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Video.ts
│   │   ├── Comment.ts
│   │   ├── Like.ts
│   │   ├── Subscription.ts
│   │   └── View.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── video.routes.ts
│   │   ├── stream.routes.ts
│   │   ├── comment.routes.ts
│   │   ├── like.routes.ts
│   │   ├── subscription.routes.ts
│   │   ├── user.routes.ts
│   │   └── admin.routes.ts
│   ├── services/
│   │   ├── ffmpeg.service.ts
│   │   └── processing.service.ts
│   ├── utils/
│   │   ├── generateToken.ts
│   │   ├── escapeRegex.ts
│   │   ├── pickFields.ts
│   │   ├── logger.ts                  # structured JSON logger, see STEP 4
│   │   ├── asyncHandler.ts            # typed wrapper, see STEP 4
│   │   └── pathHelpers.ts
│   ├── types/
│   │   └── express.d.ts               # global Express.Request augmentation, see STEP 4
│   ├── seed/
│   │   ├── seedAdmin.ts
│   │   ├── seedDemo.ts                # see STEP 37
│   │   └── demo-assets/
│   │       ├── videos/                # 14 short MP4s (gitignored, see STEP 37)
│   │       │   └── .gitkeep
│   │       └── metadata.json          # creators + videos + comments + subs
│   └── index.ts                       # entry point
├── uploads/
│   ├── raw/          # multer destination, deleted after processing
│   └── processed/    # final HLS output, served statically
│       └── .gitkeep
├── dist/             # tsc output, gitignored
├── tsconfig.json
├── .env.example
├── .env              # gitignored
├── .dockerignore     # excludes node_modules, .env, uploads, src from image (we ship dist)
├── Dockerfile        # multi-stage: builder (tsc) + runtime (node + ffmpeg), see STEP 40
├── fly.toml          # Fly.io app config + volume mount, see STEP 41
└── package.json
```

> **Validators are gone.** In the JS edition this folder held `express-validator` chains. The TS edition uses Zod schemas from `@shared/schemas/*` directly inside the `validate.middleware.ts` runner — one schema, two consumers (server + client form).

**`client/` tree:**

```
client/
├── public/
│   ├── favicon.svg
│   ├── og-cover.png       # 1200×630 brutalist social-share image, see STEP 23
│   └── _redirects         # Netlify SPA fallback, see STEP 42
├── src/
│   ├── api/
│   │   └── axios.ts
│   ├── assets/
│   │   └── noise.svg
│   ├── components/
│   │   ├── brutal/         # design system primitives
│   │   │   ├── BrutalButton.tsx
│   │   │   ├── BrutalInput.tsx
│   │   │   ├── BrutalCard.tsx
│   │   │   ├── BrutalBadge.tsx
│   │   │   ├── BrutalModal.tsx
│   │   │   ├── BrutalToggle.tsx
│   │   │   └── BrutalDivider.tsx
│   │   ├── feedback/
│   │   │   ├── AsciiSpinner.tsx
│   │   │   ├── ScanlineOverlay.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── ErrorBlock.tsx
│   │   ├── video/
│   │   │   ├── VideoCard.tsx
│   │   │   ├── VideoGrid.tsx
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── VideoMeta.tsx
│   │   │   ├── ViewCounter.tsx
│   │   │   └── ProcessingStatus.tsx
│   │   ├── comment/
│   │   │   ├── CommentList.tsx
│   │   │   ├── CommentItem.tsx
│   │   │   └── CommentForm.tsx
│   │   ├── upload/
│   │   │   ├── DropZone.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── MainLayout.tsx
│   │   │   ├── AdminLayout.tsx
│   │   │   └── SettingsLayout.tsx
│   │   └── guards/
│   │       ├── ProtectedRoute.tsx
│   │       ├── AdminRoute.tsx
│   │       ├── CreatorRoute.tsx
│   │       └── GuestOnlyRoute.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── PreferencesContext.tsx
│   ├── hooks/
│   │   ├── useLocalStorage.ts
│   │   ├── useDebounce.ts
│   │   ├── useReducedMotion.ts
│   │   ├── useUploadProgress.ts
│   │   └── useGuestFingerprint.ts
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── VideoDetailPage.tsx
│   │   ├── UploadPage.tsx
│   │   ├── StudioPage.tsx
│   │   ├── ChannelPage.tsx
│   │   ├── ProfilePage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── SubscriptionsPage.tsx
│   │   ├── settings/
│   │   │   ├── ProfileSettingsPage.tsx
│   │   │   ├── AccountSettingsPage.tsx
│   │   │   ├── AppearanceSettingsPage.tsx
│   │   │   ├── PrivacySettingsPage.tsx
│   │   │   └── NotificationSettingsPage.tsx
│   │   ├── admin/
│   │   │   ├── AdminDashboardPage.tsx
│   │   │   ├── AdminUsersPage.tsx
│   │   │   ├── AdminVideosPage.tsx
│   │   │   └── AdminCommentsPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── video.service.ts
│   │   ├── comment.service.ts
│   │   ├── like.service.ts
│   │   ├── subscription.service.ts
│   │   ├── user.service.ts
│   │   └── admin.service.ts
│   ├── utils/
│   │   ├── formatDate.ts
│   │   ├── formatDuration.ts
│   │   ├── formatViews.ts
│   │   ├── constants.ts
│   │   └── classNames.ts
│   ├── types/
│   │   └── env.d.ts                  # ImportMetaEnv augmentation
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── .env              # gitignored
├── index.html
├── tsconfig.json
├── tsconfig.node.json                # for vite.config.ts
├── vite.config.ts
└── package.json
```

### Folder Rationale

- **`server/src/`** — all TS source. `tsc` emits to `dist/`, which is what the Dockerfile copies. In dev, `tsx watch src/index.ts` runs the source directly with no emit step.
- **`server/src/config/`** — env loading + DB connection. Single source of truth, imported everywhere.
- **`server/src/controllers/`** — pure HTTP handlers; thin (input → service → response). No business logic here. Each handler typed as `RequestHandler<...>` from express.
- **`server/src/middleware/`** — cross-cutting concerns (auth, role guards, validation, sanitize, rate limiters, request ID, error handler).
- **`server/src/services/`** — business logic that doesn't fit a single controller (FFmpeg pipeline, processing orchestrator).
- **`server/src/utils/`** — pure helpers + the structured logger + `asyncHandler` wrapper (typed Promise<void> handler → Express RequestHandler).
- **`server/src/types/`** — ambient TS declaration files (`*.d.ts`). `express.d.ts` augments `Express.Request` with `req.user` and `req.id`.
- **`server/src/seed/`** — one-shot scripts (admin bootstrap, demo seed). Idempotent.
- **`server/uploads/`** — local-only working directory (gitignored). In production, this maps to Fly.io's persistent volume mount at `/data` (STEP 41).
- **`client/src/types/`** — ambient `.d.ts` files (Vite env, asset modules).
- **`client/src/components/brutal/`** — design system primitives. Every page composes from these — no inline styles allowed in pages.
- **`client/src/components/guards/`** — route-level access control wrappers (consumed by `App.tsx`'s router).

### Notes on Specific Files

- `Dockerfile` and `fly.toml` only become relevant when you reach STEP 40 / STEP 41 — but they live next to `package.json` so the Fly.io CLI finds them automatically.
- `server/uploads/raw/.gitkeep` and `server/uploads/processed/.gitkeep` exist to track empty folders in git (the actual upload contents are gitignored — see STEP 2's `.gitignore`).
- `client/public/og-cover.png` is a deliverable from STEP 23, not from this step — leave a placeholder PNG for now.
- `client/public/_redirects` is required by Netlify (STEP 42) but you can create it now to keep the structure complete.
- `tsconfig.node.json` in client exists so `vite.config.ts` (which runs in Node, not the browser) compiles with Node types.

**SECURITY:**
- The folder structure separates auth/role logic (`middleware/`) from business logic (`controllers/services/`) — easier to audit which code path enforces what.
- `seed/demo-assets/videos/` is gitignored — demo MP4s NEVER ship in the repo (size + licensing concerns).
- `uploads/` is gitignored — user-uploaded content NEVER ends up in git.
- `dist/` is gitignored — only source is reviewed in PRs.

---

## STEP 2 — Server & Client Dependencies + FFmpeg System Requirement

Install all production + dev dependencies for the workspace, document the FFmpeg system requirement, and add the root `.gitignore` that protects you from committing secrets or upload bulk.

### Server `package.json`

```json
{
  "name": "fragment-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --build",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "seed:admin": "tsx src/seed/seedAdmin.ts",
    "seed:demo": "tsx src/seed/seedDemo.ts"
  },
  "engines": { "node": ">=20.0.0" }
}
```

| Production dependency | Purpose |
|---|---|
| `express@^5` | Web server |
| `mongoose@^8` | MongoDB ODM (v8 — current stable; v9 not yet released) |
| `dotenv` | Env loader |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT auth |
| `cors` | Cross-origin policy |
| `helmet` | HTTP security headers |
| `express-rate-limit` | Rate limiting |
| `zod` | Runtime validation + types (replaces `express-validator`) |
| `express-mongo-sanitize` | NoSQL injection prevention (used via `.sanitize()` only) |
| `multer@^2` | File upload middleware |
| `fluent-ffmpeg` | FFmpeg wrapper |
| `nanoid` | Short unique IDs for video folders |
| `@fragment/shared` | Workspace dep — shared types & schemas |

| Dev dependency | Purpose |
|---|---|
| `typescript@^5.6` | Compiler |
| `tsx@^4.19` | Dev runner (TS execute, no transpile step) |
| `@types/node@^22` | Node API types |
| `@types/express@^5` | Express types |
| `@types/cors` | |
| `@types/bcryptjs` | |
| `@types/jsonwebtoken` | |
| `@types/multer` | |
| `@types/fluent-ffmpeg` | |
| `@types/express-mongo-sanitize` | |

> **Why `tsx` not `ts-node`?** `tsx` uses esbuild internally — restarts in <100ms, supports ESM out of the box, no `ts-node/esm` loader gymnastics. Production still uses `tsc` to emit JS so the runtime needs zero TS tooling.

### Client `package.json`

```json
{
  "name": "fragment-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --build && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

| Production dependency | Purpose |
|---|---|
| `react@^19`, `react-dom@^19` | UI framework |
| `react-router-dom@^7` | Routing |
| `axios` | HTTP client |
| `react-player@^3` | HLS-capable video player (uses HLS.js internally) |
| `react-hot-toast` | Brutalist-styled toasts |
| `lucide-react` | Icon set (used sparingly, monospace look) |
| `zod` | Form validation (shared schemas) |
| `@fragment/shared` | Workspace dep |

| Dev dependency | Purpose |
|---|---|
| `typescript@^5.6` | |
| `vite@^8` | Build tool |
| `@vitejs/plugin-react@^6` | |
| `tailwindcss@^4`, `@tailwindcss/vite@^4` | |
| `@types/react@^19`, `@types/react-dom@^19` | |
| `eslint@^10`, `@eslint/js@^10`, `eslint-plugin-react-hooks@^7`, `eslint-plugin-react-refresh` | |
| `typescript-eslint@^8` | Replaces the old `@typescript-eslint/*` split — flat config compatible |

**FFmpeg system requirement:**

`fluent-ffmpeg` is a Node.js wrapper — the actual `ffmpeg` and `ffprobe` binaries MUST be installed on the host OS. Document in README:

- **Windows:** Download from `ffmpeg.org/download.html`, add `bin/` to PATH.
- **macOS:** `brew install ffmpeg`.
- **Linux/WSL:** `sudo apt update && sudo apt install ffmpeg`.
- **Fly.io production:** ffmpeg is installed inside the Docker image via `apt install ffmpeg` (covered in STEP 40).
- **Verification:** `ffmpeg -version` must print version info from any shell.

**Root `.gitignore`:**

```
node_modules/
.env
.env.local
dist/
build/
logs/
*.log
.DS_Store
.vscode/
.idea/
*.tsbuildinfo
server/uploads/raw/*
!server/uploads/raw/.gitkeep
server/uploads/processed/*
!server/uploads/processed/.gitkeep
server/seed/demo-assets/videos/*
!server/seed/demo-assets/videos/.gitkeep
```

`*.tsbuildinfo` is the incremental compile cache TypeScript writes when `composite: true` — useful locally, never committed.

**SECURITY:**
- `.env` files NEVER committed — verify `.gitignore` covers both root and nested paths.
- `uploads/` content excluded from git — only `.gitkeep` placeholders tracked.
- No real secrets in `.env.example` — only key names and placeholder values.
- `dist/` excluded — production artifacts are built fresh in CI / Docker, never trusted from a contributor's machine.

---

## STEP 3 — Environment Configuration & Database Connection

This step defines the single source of truth for runtime configuration and the MongoDB connection bootstrap. Logging, request tracing, sanitization, rate limiting, and the actual Express entry point all come in STEP 4 and STEP 5.

### `server/tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"],
    "lib": ["ES2022"],
    "composite": true,
    "declaration": false,
    "sourceMap": true
  },
  "references": [{ "path": "../shared" }],
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

The `references` array makes `tsc --build` rebuild `shared` first when needed. Path `@shared/*` resolves through `tsconfig.base.json`.

### `server/src/config/env.ts`

Single source of truth, validated at module-load time using Zod so misconfiguration crashes immediately.

| Variable | Type | Default | Notes |
|---|---|---|---|
| `PORT` | number | `5000` | API port |
| `NODE_ENV` | `'development' \| 'production' \| 'test'` | `development` | `production` triggers strict checks |
| `MONGO_URI` | string | required | Mongo connection string |
| `JWT_SECRET` | string | required | **In production: min 32 chars enforced via Zod refine** |
| `JWT_EXPIRES_IN` | string | `7d` | Token lifetime |
| `BCRYPT_SALT_ROUNDS` | number | `12` | Password hash cost |
| `CLIENT_ORIGIN` | string | `http://localhost:5173` | CORS allowed origin (no `*` in prod) |
| `MAX_UPLOAD_SIZE_MB` | number | `500` (dev) / `100` (Fly.io prod) | Multer file size limit |
| `UPLOAD_DIR_RAW` | string | `uploads/raw` | Multer destination |
| `UPLOAD_DIR_PROCESSED` | string | `uploads/processed` | HLS output root |
| `HLS_SEGMENT_DURATION` | number | `10` | Seconds per `.ts` segment |
| `THUMBNAIL_TIMESTAMP` | string | `00:00:02` | Frame capture time |
| `MAX_VIDEO_DURATION_SECONDS` | number | `600` (dev) / `120` (Fly.io prod) | Hard cap; rejects longer uploads after FFprobe |
| `DISK_QUOTA_MB` | number | `2800` | Soft disk quota for `processed/` folder |

```ts
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRES_IN: z.string().default('7d'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
    MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(500),
    UPLOAD_DIR_RAW: z.string().default('uploads/raw'),
    UPLOAD_DIR_PROCESSED: z.string().default('uploads/processed'),
    HLS_SEGMENT_DURATION: z.coerce.number().int().positive().default(10),
    THUMBNAIL_TIMESTAMP: z.string().default('00:00:02'),
    MAX_VIDEO_DURATION_SECONDS: z.coerce.number().int().positive().default(600),
    DISK_QUOTA_MB: z.coerce.number().int().positive().default(2800),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV === 'production' && cfg.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] invalid configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
```

### `server/src/config/db.ts`

```ts
import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('[DB] connected');
  } catch (err) {
    console.error('[DB] connection failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
};
```

> **Mongoose 8 note:** No more `useNewUrlParser`, `useUnifiedTopology`, etc. — those options were removed. A plain `mongoose.connect(uri)` call is all you need.

### `.env.example`

Commit a placeholder file with all keys from the table above and dummy values. NEVER commit a real `.env`. The user (and any future contributor) copies `.env.example` → `.env` and fills in real values.

**SECURITY:**
- Helmet, CORS, body-size limits, etc. all live in STEP 5 — but the **JWT_SECRET length check** runs at module load time here via Zod's `superRefine`, so a misconfigured production deploy crashes immediately on startup instead of silently signing tokens with a weak secret.
- `.env` is in `.gitignore` from STEP 1.
- Production `MONGO_URI` includes credentials — keep it in Fly.io secrets, never in source (STEP 41).
- `process.exit(1)` on DB failure prevents Fly.io's healthcheck from ever marking the machine as healthy → bad config never serves traffic.
- `Object.freeze(parsed.data)` makes the env object truly immutable at runtime (Zod parse already produces a fresh object).

---

## STEP 4 — Logging, Request ID, Express Augmentation & Sanitize Middleware

This step adds the observability + safety primitives that every other middleware and controller depends on: structured logging, per-request tracing, the global `Express.Request` augmentation, and NoSQL sanitization. Rate limiting and the final Express entry point come in STEP 5.

### `server/src/types/express.d.ts`

Augment Express's `Request` so every controller sees `req.user` and `req.id` with proper types.

```ts
import type { HydratedDocument } from 'mongoose';
import type { UserDoc } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user: UserDoc | null;
    }
  }
}

export {};
```

The empty `export {}` makes this file a module — required for `declare global` to take effect in TS isolated modules mode.

### `server/src/utils/asyncHandler.ts`

Tiny wrapper that lets controllers be `async` functions and forwards thrown errors to Express's error handler.

```ts
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncFn<P, ResBody, ReqBody, ReqQuery> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler =
  <P = unknown, ResBody = unknown, ReqBody = unknown, ReqQuery = unknown>(
    fn: AsyncFn<P, ResBody, ReqBody, ReqQuery>,
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
```

Every controller in this guide is wrapped: `router.get('/', asyncHandler(listVideos))`. Without this, Express 5 still bubbles async rejections, but the typed wrapper gives us full Request generic inference downstream.

### `server/src/utils/logger.ts`

Zero-dependency structured JSON logger. Native `console.log(JSON.stringify(...))` output streams cleanly into `fly logs`, Datadog, or any log aggregator without extra parsing.

```ts
import { env } from '../config/env.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogContext = Record<string, unknown>;

const log = (level: LogLevel, message: string, context: LogContext = {}): void => {
  const entry = { timestamp: new Date().toISOString(), level, message, ...context };
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  stream(JSON.stringify(entry));
};

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
  debug: (message: string, context?: LogContext) => {
    if (env.NODE_ENV !== 'production') log('debug', message, context);
  },
};
```

Use this everywhere instead of bare `console.log` from now on. Pretty-print mode is intentionally NOT included — single-line JSON is what `fly logs | grep` thrives on.

### `server/src/middleware/requestId.middleware.ts`

Assigns a unique ID to every incoming request, surfaces it back to the client, and attaches it to logs/errors for end-to-end traceability.

```ts
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get('X-Request-Id');
  req.id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
```

The middleware accepts an upstream `X-Request-Id` (e.g., from Cloudflare or Fly.io's edge proxy) **only if it matches a strict regex** — otherwise it generates a fresh UUID. This prevents log injection / spoofing attacks where a malicious client supplies a forged trace ID with embedded JSON or newlines.

### `server/src/middleware/error.middleware.ts`

```ts
import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface HttpError extends Error {
  status?: number;
  code?: number | string;
}

export const errorHandler: ErrorRequestHandler = (err: HttpError, req, res, _next) => {
  const status = err.status ?? 500;
  logger.error('request_failed', {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode: status,
    errorMessage: err.message,
    stack: env.NODE_ENV === 'production' ? undefined : err.stack,
  });
  res.status(status).json({
    success: false,
    message: err.message,
    requestId: req.id,
  });
};
```

The client receives `requestId` in every error response — when a user reports "the upload failed", they (or you, in the admin panel) can copy that ID and `fly logs | grep <requestId>` jumps straight to the failing request's full log trail.

### `server/src/middleware/requestLogger.middleware.ts`

One-line structured access log per request. Skips noisy paths so log volume stays cheap on Fly.io.

```ts
import type { RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

const SKIP_PATHS = [/^\/api\/health$/, /^\/api\/stream\/.+\.ts$/];

export const requestLogger: RequestHandler = (req, res, next) => {
  if (SKIP_PATHS.some((re) => re.test(req.originalUrl))) {
    next();
    return;
  }
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('http', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?._id?.toString(),
    });
  });
  next();
};
```

### `server/src/middleware/sanitize.middleware.ts`

Express 5 compatible NoSQL sanitizer.

```ts
import type { RequestHandler } from 'express';
import mongoSanitize from 'express-mongo-sanitize';

export const sanitizeMongo: RequestHandler = (req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
};
```

> **EXPRESS 5 CRITICAL:** Do NOT use `app.use(mongoSanitize())` directly — it reassigns `req.query`, which is a read-only getter in Express 5 and will crash every request. Do NOT install `hpp` for the same reason. Treat `req.query` as immutable everywhere.

**SECURITY (STEP 4 boundary):**
- Structured JSON logger emits stack traces ONLY in non-production. Production logs include `requestId`, `method`, `path`, `statusCode`, `errorMessage` — enough to debug, never enough to leak internals.
- Request IDs are validated against a strict regex before being trusted from upstream — defends against log injection / forgery.
- The `requestLogger` skips `/api/health` and HLS `.ts` segments — both are noise.
- The custom `sanitizeMongo` middleware is the Express 5 safe replacement for `express-mongo-sanitize` — it sanitizes `req.body` and `req.params` only, never `req.query`.
- Express augmentation (`req.user`, `req.id`) is **purely a TS hint** — the auth middleware in STEP 6 is what actually populates `req.user`. Without that middleware, `req.user` is `null` (note the type — not `undefined`, so consumers don't need optional chaining for the existence check; they use null-guard explicitly).

---

## STEP 5 — Rate Limiters & Hardened Server Entry

This is the final assembly step: separate rate limiters per concern, the CORS config that exposes the rate-limit + request-id headers, and the `server/src/index.ts` entry point with strict middleware ordering.

### `server/src/middleware/rateLimiters.ts`

Separate limiters per concern:

| Limiter | `windowMs` | `max` | Applied to |
|---|---|---|---|
| `globalLimiter` | 15 min | 300 | All `/api/*` |
| `authLimiter` | 15 min | 10 | `/api/auth/login`, `/api/auth/register` |
| `uploadLimiter` | 60 min | 20 | `/api/videos/upload` |
| `commentLimiter` | 1 min | 10 | `POST /api/comments` |
| `adminLimiter` | 15 min | 100 | `/api/admin/*` |

```ts
import rateLimit, { type Options } from 'express-rate-limit';

const baseOptions: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, slow down.' },
};

export const globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 300,
});

export const authLimiter = rateLimit({ ...baseOptions, windowMs: 15 * 60 * 1000, max: 10 });
export const uploadLimiter = rateLimit({ ...baseOptions, windowMs: 60 * 60 * 1000, max: 20 });
export const commentLimiter = rateLimit({ ...baseOptions, windowMs: 60 * 1000, max: 10 });
export const adminLimiter = rateLimit({ ...baseOptions, windowMs: 15 * 60 * 1000, max: 100 });
```

Headers surfaced to the client (and exposed via CORS in `corsOptions.exposedHeaders` so browsers can read them):

| Header | Meaning | Example |
|---|---|---|
| `RateLimit-Limit` | Quota for the window | `300` |
| `RateLimit-Remaining` | Requests left in this window | `297` |
| `RateLimit-Reset` | Seconds until the window resets | `842` |
| `Retry-After` | Sent only on 429 — seconds to back off | `60` |

The frontend reads these from every Axios response interceptor. When `RateLimit-Remaining < 5` on the auth or upload limiter, a brutal toast surfaces the warning: `// 3 REQUESTS LEFT // SLOW DOWN`. On 429, the toast message uses `Retry-After` directly: `// THROTTLED // RETRY IN 47s`.

### `server/src/index.ts` — Express 5 entry point

```ts
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { requestId } from './middleware/requestId.middleware.js';
import { sanitizeMongo } from './middleware/sanitize.middleware.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { globalLimiter } from './middleware/rateLimiters.js';
import { logger } from './utils/logger.js';
// route imports follow per resource

const app = express();

app.disable('x-powered-by');
app.use(requestId);
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After', 'X-Request-Id'],
  }),
);
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(sanitizeMongo);
app.use(requestLogger);
app.use('/api', globalLimiter);

app.use(
  '/api/stream',
  express.static(path.resolve(env.UPLOAD_DIR_PROCESSED), {
    fallthrough: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.m3u8')) res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      if (filePath.endsWith('.ts')) res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', env.CLIENT_ORIGIN);
    },
  }),
);

// Route mounts: app.use('/api/auth', authRouter); ... etc.

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', requestId: req.id });
});

app.use(errorHandler);

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(env.PORT, () => {
    logger.info('server_started', { port: env.PORT, env: env.NODE_ENV });
  });
};

start().catch((err) => {
  logger.error('server_start_failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
```

Middleware order is critical:
1. `app.disable('x-powered-by')`.
2. `requestId` — must run first so every downstream middleware sees `req.id`.
3. `helmet()` — security headers.
4. `cors({ ... exposedHeaders: [...] })`.
5. `express.json({ limit: '50kb' })` — small for non-upload routes.
6. `express.urlencoded({ extended: true, limit: '50kb' })`.
7. `sanitizeMongo`.
8. `requestLogger`.
9. `globalLimiter` on `/api`.
10. Static serving of processed HLS folder (read-only, see STEP 11).
11. Route mounts: `/api/auth`, `/api/videos`, `/api/comments`, `/api/likes`, `/api/subscriptions`, `/api/users`, `/api/admin`.
12. `GET /api/health`.
13. 404 handler.
14. Error handler middleware (last).

**`.env.example`** — all keys from the table above with placeholder values, NO real secrets.

**SECURITY (STEP 5 boundary):**
- Helmet always on. Production CORS origin is strict (single value, never `*`).
- Body size limits (`50kb` for non-upload routes) prevent DoS via large JSON payloads.
- `x-powered-by` disabled to hide framework fingerprint.
- Rate limiters scoped per concern — auth is the strictest (10/15min).
- `RateLimit-*` headers surfaced via `standardHeaders: 'draft-7'` and CORS `exposedHeaders`.
- Health check exposes no internals.
- Error responses include `requestId` so reported issues are end-to-end traceable.
- Middleware order is **not** cosmetic — `requestId` MUST run before `helmet`/`cors`.
- The `start()` function awaits DB before binding the port — Fly.io healthcheck never sees a half-initialized server.

---

## STEP 6 — User Model, Auth System, Role Hierarchy & Admin Seed

### `server/src/models/User.ts` — Schema + Inferred Types

```ts
import bcrypt from 'bcryptjs';
import { type HydratedDocument, type InferSchemaType, type Model, Schema, model } from 'mongoose';
import { env } from '../config/env.js';
import { USER_ROLES } from '@shared/constants/enums.js';

const preferencesSchema = new Schema(
  {
    theme: { type: String, enum: ['light', 'dark', 'system'] as const, default: 'dark' },
    accentColor: { type: String, enum: ['acid', 'magenta', 'electric', 'orange'] as const, default: 'acid' },
    fontSize: { type: String, enum: ['sm', 'md', 'lg'] as const, default: 'md' },
    density: { type: String, enum: ['compact', 'comfortable'] as const, default: 'comfortable' },
    animations: { type: String, enum: ['full', 'reduced', 'off'] as const, default: 'full' },
    scanlines: { type: Boolean, default: true },
    language: { type: String, enum: ['en'] as const, default: 'en' },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showHistory: { type: Boolean, default: false },
      showSubscriptions: { type: Boolean, default: true },
    },
    notifications: {
      newSubscriber: { type: Boolean, default: true },
      newComment: { type: Boolean, default: true },
    },
    content: {
      autoplay: { type: Boolean, default: false },
      defaultVolume: { type: Number, default: 0.8, min: 0, max: 1 },
    },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 24,
      match: /^[a-zA-Z0-9_]+$/,
      lowercase: true,
      index: true,
    },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: USER_ROLES, default: 'viewer', required: true },
    displayName: { type: String, maxlength: 48 },
    bio: { type: String, default: '', maxlength: 280 },
    avatarUrl: { type: String, default: null },
    bannerUrl: { type: String, default: null },
    subscriberCount: { type: Number, default: 0, required: true },
    videoCount: { type: Number, default: 0, required: true },
    totalViews: { type: Number, default: 0, required: true },
    preferences: { type: preferencesSchema, default: () => ({}) },
    isBanned: { type: Boolean, default: false, required: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);
});

interface UserMethods {
  comparePassword(plain: string): Promise<boolean>;
}

userSchema.methods.comparePassword = async function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.password);
};

export type UserSchemaType = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserSchemaType, UserMethods>;
type UserModel = Model<UserSchemaType, Record<string, never>, UserMethods>;

export const User = model<UserSchemaType, UserModel>('User', userSchema);
```

> **MONGOOSE 8 RULE:** Pre-save hooks use `async function()` without a `next` parameter. Use `return` for early exit. Calling `next()` throws `TypeError: next is not a function`.

**Role permissions:**

| Permission | viewer | creator | admin |
|---|---|---|---|
| Watch videos | ✅ | ✅ | ✅ |
| Like / comment / subscribe | ✅ | ✅ | ✅ |
| Upload videos | ❌ | ✅ | ✅ |
| Edit / delete own videos | ❌ | ✅ | ✅ |
| Moderate any user / video / comment | ❌ | ❌ | ✅ |
| Access `/admin` | ❌ | ❌ | ✅ |

A viewer can self-promote to creator via `POST /api/users/me/become-creator`.

### `server/src/utils/generateToken.ts`

```ts
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export const generateToken = (userId: string): string =>
  jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);
```

### `server/src/middleware/auth.middleware.ts`

```ts
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

type JwtPayload = { id: string };

const extractToken = (header: string | undefined): string | null => {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

export const protect: RequestHandler = async (req, res, next) => {
  const token = extractToken(req.get('Authorization'));
  if (!token) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(payload.id);
    if (!user || user.isBanned) {
      res.status(401).json({ success: false, message: 'Invalid session' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req.get('Authorization'));
  if (!token) {
    req.user = null;
    next();
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(payload.id);
    req.user = user && !user.isBanned ? user : null;
  } catch {
    req.user = null;
  }
  next();
};
```

### `server/src/middleware/role.middleware.ts`

```ts
import type { RequestHandler } from 'express';
import type { UserRole } from '@shared/constants/enums.js';

export const requireRole = (...allowed: UserRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
};

export const adminOnly = requireRole('admin');
export const creatorOrAdmin = requireRole('creator', 'admin');
```

`requireRole` is variadic and typed against the shared `UserRole` union — passing `'creator '` (typo) fails compile time.

### `server/src/utils/pickFields.ts`

```ts
export const pickFields = <T extends object, K extends keyof T>(
  obj: T,
  allowedKeys: readonly K[],
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  for (const key of allowedKeys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
};
```

Generic + readonly tuple in, fully-typed `Pick<T, K>` out — used everywhere to prevent mass assignment.

### `server/src/controllers/auth.controller.ts`

| Function | Method + Path | Behavior |
|---|---|---|
| `register` | POST `/api/auth/register` | Validated by `registerSchema` from `@shared/schemas/auth.schema`. **NEVER read `role` from body.** Create user with default `role: 'viewer'`. Issue JWT. Return `{ user (sanitized), token }`. |
| `login` | POST `/api/auth/login` | Validated by `loginSchema`. Find user `.select('+password')`. On miss OR password mismatch return identical message: `'Invalid email or password'`. Reject banned users with `'Account suspended'`. Update `lastLoginAt`. Return `{ user, token }`. |
| `getMe` | GET `/api/auth/me` (protect) | Return `req.user`. |
| `updateProfile` | PATCH `/api/auth/me` (protect) | Pick only `displayName, bio, bannerUrl`. Reject any attempt to set `role`, `email`, `password`, `isBanned`, counters. |
| `changePassword` | POST `/api/auth/change-password` (protect) | Validated by `changePasswordSchema`. Verify current. Update. Save. |
| `deleteAccount` | DELETE `/api/auth/me` (protect) | Pick `password`. Verify. Cascade delete: user's videos (and their HLS folders on disk), comments, likes, subscriptions, views. Then delete user. |

Example handler signature (the rest follow the same pattern):

```ts
import type { Request, Response } from 'express';
import type { RegisterInput } from '@shared/schemas/auth.schema.js';
import type { ApiResponse } from '@shared/types/api.js';
import type { AuthResponse } from '@shared/types/user.js';
import { User } from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

export const register = async (
  req: Request<unknown, ApiResponse<AuthResponse>, RegisterInput>,
  res: Response<ApiResponse<AuthResponse>>,
): Promise<void> => {
  const { username, email, password } = req.body;
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    res.status(409).json({ success: false, message: 'Account already exists' });
    return;
  }
  const user = await User.create({ username, email, password });
  res.status(201).json({
    success: true,
    data: { user: user.toJSON() as never, token: generateToken(user._id.toString()) },
  });
};
```

Note the typed `Request<Params, ResBody, ReqBody, ReqQuery>` signature — `req.body` is `RegisterInput`, no `as` casts needed.

### `server/src/middleware/error.middleware.ts` — Mongoose-aware extension

The basic version was shown in STEP 4. Extend with type-aware branches:

```ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Error as MongooseError } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let message = 'Internal server error';

  if (err instanceof ZodError) {
    status = 422;
    message = 'Validation failed';
  } else if (err instanceof MongooseError.ValidationError) {
    status = 422;
    message = 'Validation failed';
  } else if (err instanceof MongooseError.CastError) {
    status = 400;
    message = 'Invalid identifier';
  } else if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
    status = 409;
    message = 'Resource already exists';
  } else if (err instanceof Error) {
    message = err.message;
    status = (err as { status?: number }).status ?? 500;
  }

  logger.error('request_failed', {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode: status,
    errorMessage: message,
    stack: env.NODE_ENV === 'production' ? undefined : (err as Error)?.stack,
  });

  res.status(status).json({ success: false, message, requestId: req.id });
};
```

### `server/src/seed/seedAdmin.ts`

```ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

const run = async (): Promise<void> => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !username || !password) {
    console.error('[seed:admin] SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD are required');
    process.exit(1);
  }
  await mongoose.connect(env.MONGO_URI);
  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log(`[seed:admin] admin already exists: ${existing.username}`);
  } else {
    const admin = await User.create({ username, email, password, role: 'admin', displayName: username });
    console.log(`[seed:admin] created admin: ${admin.username}`);
  }
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('[seed:admin] failed:', err);
  process.exit(1);
});
```

**SECURITY:**
- `role` is NEVER read from request body in any auth route — mass assignment locked at controller AND at the Zod schema level (`registerSchema` doesn't even define a `role` field).
- Login error message is identical for unknown email and wrong password — prevents user enumeration.
- Duplicate email response on register is also generic.
- Password field has `select: false` — never serialized.
- Password comparison uses constant-time `bcrypt.compare`.
- Banned users cannot log in or use existing tokens (`protect` and `optionalAuth` both check `isBanned`).
- Account deletion cascades all related data.
- Production error handler strips stack traces and internal Mongoose detail.

---

## STEP 7 — Video Model & Status State Machine

This step defines the `Video` schema, indexes, and the status lifecycle that every uploaded video moves through. The actual FFmpeg pipeline that drives status transitions lives in STEP 8.

### `server/src/models/Video.ts`

```ts
import { type HydratedDocument, type InferSchemaType, type Model, Schema, model } from 'mongoose';
import { nanoid } from 'nanoid';
import { VIDEO_STATUSES, VIDEO_VISIBILITIES } from '@shared/constants/enums.js';

const videoSchema = new Schema(
  {
    videoId: { type: String, required: true, unique: true, default: () => nanoid(12), index: true },
    title: { type: String, required: true, minlength: 3, maxlength: 120, trim: true },
    description: { type: String, default: '', maxlength: 5000 },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: VIDEO_STATUSES, default: 'pending', required: true, index: true },
    processingError: { type: String, default: null },
    hlsPath: { type: String, default: null },
    thumbnailPath: { type: String, default: null },
    duration: { type: Number, default: 0 },
    originalFilename: { type: String, default: null },
    fileSize: { type: Number, default: 0 },
    views: { type: Number, default: 0, required: true },
    likeCount: { type: Number, default: 0, required: true },
    dislikeCount: { type: Number, default: 0, required: true },
    commentCount: { type: Number, default: 0, required: true },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]): boolean => v.length <= 8 && v.every((t) => t.length >= 1 && t.length <= 24),
        message: 'tags must be 1–8 entries, each 1–24 chars',
      },
    },
    visibility: { type: String, enum: VIDEO_VISIBILITIES, default: 'public', required: true },
    isFlagged: { type: Boolean, default: false, required: true },
  },
  { timestamps: true },
);

videoSchema.index({ author: 1, createdAt: -1 });
videoSchema.index({ title: 'text', description: 'text', tags: 'text' });

export type VideoSchemaType = InferSchemaType<typeof videoSchema>;
export type VideoDoc = HydratedDocument<VideoSchemaType>;
type VideoModel = Model<VideoSchemaType>;

export const Video = model<VideoSchemaType, VideoModel>('Video', videoSchema);
```

The schema enums reference the shared `as const` arrays — same source of truth as the client's `VideoStatus` type.

### Status State Machine

```
pending --[upload accepted]--> processing --[ffmpeg success]--> ready
                                          \--[ffmpeg failure]--> failed
```

| Status | Set when | Visible to |
|---|---|---|
| `pending` | Multer accepts the upload, before FFmpeg starts | Author + admin |
| `processing` | FFmpeg pipeline begins (STEP 8) | Author + admin |
| `ready` | Transcode + thumbnail succeeded, `hlsPath` populated | Public (everyone) |
| `failed` | FFmpeg threw, duration cap exceeded, or pre-flight failed | Author + admin (with `processingError`) |

Only `ready` videos are returned by public endpoints.

### Denormalized Counters

`views`, `likeCount`, `dislikeCount`, `commentCount` are denormalized — they live on the video doc instead of being computed via `$lookup`/`countDocuments` on every page load. Each create/delete/update operation in the Like/Comment/View controllers wraps the DB write in a `Promise.all` that also runs `Video.findByIdAndUpdate(..., { $inc: { likeCount: ±1 } })`.

**SECURITY:**
- `videoId` is `nanoid(12)` — URL-safe and non-guessable enough that even unlisted videos aren't trivially discoverable.
- `tags` length-capped at the schema layer.
- `processingError` field exists in the schema but is stripped from public API responses (controller filter at STEP 10).
- `status` and `visibility` enums are TS literal unions sourced from `@shared/constants` — invalid values fail compile time AND Mongoose validation.

---

## STEP 8 — FFmpeg HLS Pipeline (Probe + Transcode + Thumbnail + Cleanup)

Two service files are involved — `ffmpeg.service.ts` (low-level FFmpeg wrappers) and `processing.service.ts` (orchestrator with error handling, duration cap, and disk hygiene).

### `server/src/services/ffmpeg.service.ts`

```ts
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { env } from '../config/env.js';

export const probeDuration = (inputPath: string): Promise<number> =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Math.round(data.format.duration ?? 0));
    });
  });

export const transcodeToHls = (inputPath: string, outputDir: string): Promise<{ duration: number }> =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(path.join(outputDir, 'index.m3u8'))
      .videoCodec('libx264')
      .audioCodec('aac')
      .addOption('-preset', 'veryfast')
      .addOption('-hls_time', String(env.HLS_SEGMENT_DURATION))
      .addOption('-hls_list_size', '0')
      .addOption('-hls_segment_filename', path.join(outputDir, '%03d.ts'))
      .addOption('-f', 'hls')
      .on('end', () => {
        ffmpeg.ffprobe(inputPath, (e, data) => {
          if (e) {
            reject(e);
            return;
          }
          resolve({ duration: Math.round(data.format.duration ?? 0) });
        });
      })
      .on('error', reject)
      .run();
  });

export const generateThumbnail = (inputPath: string, outputDir: string): Promise<string> =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [env.THUMBNAIL_TIMESTAMP],
        filename: 'thumbnail.jpg',
        folder: outputDir,
        size: '1280x720',
      })
      .on('end', () => resolve('thumbnail.jpg'))
      .on('error', reject);
  });
```

> **`@types/fluent-ffmpeg` quirk:** the type for `screenshots` `.on('end', cb)` callback is loose — the runtime fires `end` with no arg, and our handler ignores any. Acceptable.

### `server/src/services/processing.service.ts`

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import type { VideoDoc } from '../models/Video.js';
import { generateThumbnail, probeDuration, transcodeToHls } from './ffmpeg.service.js';

export const processVideo = async (videoDoc: VideoDoc, rawPath: string): Promise<void> => {
  const outputDir = path.join(env.UPLOAD_DIR_PROCESSED, videoDoc.videoId);
  try {
    const probedDuration = await probeDuration(rawPath);
    if (probedDuration > env.MAX_VIDEO_DURATION_SECONDS) {
      throw new Error(`Video exceeds maximum duration (${env.MAX_VIDEO_DURATION_SECONDS}s)`);
    }
    await fs.mkdir(outputDir, { recursive: true });
    videoDoc.status = 'processing';
    await videoDoc.save();
    const [{ duration }] = await Promise.all([
      transcodeToHls(rawPath, outputDir),
      generateThumbnail(rawPath, outputDir),
    ]);
    videoDoc.duration = duration;
    videoDoc.hlsPath = `processed/${videoDoc.videoId}/index.m3u8`;
    videoDoc.thumbnailPath = `processed/${videoDoc.videoId}/thumbnail.jpg`;
    videoDoc.status = 'ready';
    await videoDoc.save();
    await User.findByIdAndUpdate(videoDoc.author, { $inc: { videoCount: 1 } });
  } catch (err) {
    videoDoc.status = 'failed';
    videoDoc.processingError = err instanceof Error ? err.message : 'Unknown processing error';
    await videoDoc.save();
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  } finally {
    await fs.unlink(rawPath).catch(() => {});
  }
};
```

**Key cleanup guarantees:**
- **Pre-flight duration check** runs BEFORE any disk write — videos exceeding `MAX_VIDEO_DURATION_SECONDS` are rejected without creating an output folder.
- **On failure mid-transcode**, the partial `processed/<videoId>/` folder is removed.
- **`finally` block** always unlinks the raw upload — guaranteed even on uncaught exceptions.

> Production note (referenced in README + tips): Replace this in-process pipeline with **BullMQ + Redis** queue + worker process if concurrent uploads exceed CPU capacity. MVP uses in-process async — fire-and-forget `processVideo()` call without `await` from the controller.

**SECURITY:**
- `videoId` is `nanoid` (URL-safe, non-guessable enough), used as folder name → no path traversal possible.
- `outputDir` is constructed from `videoId`, never from user input.
- Raw file is **always** deleted after processing (success or failure) via `finally` block.
- Failed transcodes also clean up partial output folders.
- Duration cap enforced via FFprobe BEFORE expensive transcoding.
- Status state machine enforced via TS literal unions — assigning `'redy'` is a compile error.
- `processingError` strings are not exposed to public endpoints (admin/owner only).

---

## STEP 9 — Multer Upload Route & Async Processing Trigger

### `server/src/middleware/upload.middleware.ts`

```ts
import path from 'node:path';
import multer, { type FileFilterCallback } from 'multer';
import { nanoid } from 'nanoid';
import type { Request } from 'express';
import { env } from '../config/env.js';

const ALLOWED_MIME = new Set(['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR_RAW),
  filename: (_req, file, cb) => cb(null, `${nanoid(16)}${path.extname(file.originalname)}`),
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Unsupported video format'));
};

export const uploadVideoMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
}).single('video');
```

### `shared/schemas/video.schema.ts`

```ts
import { z } from 'zod';
import { SORT_OPTIONS, VIDEO_VISIBILITIES } from '../constants/enums.js';

export const createVideoSchema = z.object({
  title: z.string().min(3).max(120).trim(),
  description: z.string().max(5000).default(''),
  tags: z
    .array(z.string().min(1).max(24).toLowerCase())
    .max(8)
    .default([]),
  visibility: z.enum(VIDEO_VISIBILITIES).default('public'),
});
export type CreateVideoInput = z.infer<typeof createVideoSchema>;

export const updateVideoSchema = createVideoSchema.partial();
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;

export const listVideoQuerySchema = z.object({
  q: z.string().max(100).optional(),
  tag: z.string().max(24).toLowerCase().optional(),
  sort: z.enum(SORT_OPTIONS).default('new'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
export type ListVideoQuery = z.infer<typeof listVideoQuerySchema>;

export const viewBodySchema = z.object({
  fingerprint: z.string().uuid().optional(),
});
export type ViewBody = z.infer<typeof viewBodySchema>;
```

### `server/src/middleware/validate.middleware.ts`

The generic Zod runner — replaces the `express-validator` `validate.middleware.js` from the JS edition.

```ts
import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'params' | 'query';

export const validate =
  (schema: ZodSchema, source: Source = 'body'): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues.map((i) => ({ field: i.path.join('.'), msg: i.message })),
      });
      return;
    }
    if (source === 'body' || source === 'params') {
      req[source] = result.data;
    }
    // NOTE: req.query is read-only in Express 5 — never assign to it. For query validation, attach to a new property:
    // req.validatedQuery = result.data
    next();
  };
```

For `req.query` validation, store the parsed result on a new request property (extend `Express.Request` with `validatedQuery: unknown` in `express.d.ts` if you use this pattern).

### `server/src/controllers/upload.controller.ts` → `uploadVideo`

`POST /api/videos/upload` — middleware chain: `uploadLimiter` → `protect` → `creatorOrAdmin` → `uploadVideoMiddleware` (multer) → `validate(createVideoSchema)` → controller.

```ts
import type { Request, Response } from 'express';
import type { CreateVideoInput } from '@shared/schemas/video.schema.js';
import type { ApiResponse } from '@shared/types/api.js';
import type { VideoStatusDTO } from '@shared/types/video.js';
import { Video } from '../models/Video.js';
import { processVideo } from '../services/processing.service.js';
import { logger } from '../utils/logger.js';

export const uploadVideo = async (
  req: Request<unknown, ApiResponse<VideoStatusDTO>, CreateVideoInput>,
  res: Response<ApiResponse<VideoStatusDTO>>,
): Promise<void> => {
  if (!req.file || !req.user) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }
  const doc = await Video.create({
    title: req.body.title,
    description: req.body.description,
    tags: req.body.tags,
    visibility: req.body.visibility,
    author: req.user._id,
    originalFilename: req.file.originalname,
    fileSize: req.file.size,
  });

  res.status(201).json({
    success: true,
    data: { videoId: doc.videoId, status: doc.status, processingError: null },
  });

  // fire-and-forget — runs after response is sent
  void processVideo(doc, req.file.path).catch((err) => {
    logger.error('processing_failed', { videoId: doc.videoId, error: err instanceof Error ? err.message : String(err) });
  });
};
```

### `server/src/controllers/video.controller.ts` → `getStatus`

`GET /api/videos/:videoId/status` — public (no auth). Returns `{ videoId, status, processingError }`. `processingError` is only included for the author or an admin (use `optionalAuth` middleware).

**Routes file (`server/src/routes/video.routes.ts`)** mounts these endpoints. Full route table comes in STEP 10.

**SECURITY:**
- Only `creator` or `admin` roles can hit upload endpoint.
- `uploadLimiter` caps at 20 uploads per hour per IP.
- MIME whitelist prevents arbitrary file types.
- Size limit (default 500MB) prevents disk exhaustion.
- Filename is server-generated.
- Title, description, tags are typed via `CreateVideoInput` — `views`, `likeCount`, `status`, etc. are not in the type, so cannot be set by client.
- `processingError` details only shown to author/admin.

---

## STEP 10 — Video Public CRUD: List, Detail, Search, Filter, Pagination

### `server/src/utils/escapeRegex.ts`

```ts
export const escapeRegex = (str = ''): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

### Endpoints (`server/src/routes/video.routes.ts`)

| Method + Path | Middleware | Controller | Notes |
|---|---|---|---|
| GET `/api/videos` | `optionalAuth, validate(listVideoQuerySchema, 'query')` | `listVideos` | Public. Query: `q, tag, sort, page, limit`. Only `status: 'ready'` and `visibility: 'public'`. |
| GET `/api/videos/:videoId` | `optionalAuth` | `getVideoById` | Public for `ready+public`. Author/admin can view any status. Populates `author`. |
| GET `/api/videos/:videoId/status` | `optionalAuth` | `getStatus` | (defined STEP 9) |
| POST `/api/videos/upload` | upload chain | `uploadVideo` | (defined STEP 9) |
| GET `/api/videos/mine` | `protect, creatorOrAdmin` | `getMyVideos` | Author's own, all statuses. |
| PATCH `/api/videos/:videoId` | `protect, creatorOrAdmin, validate(updateVideoSchema)` | `updateVideo` | Whitelist via Zod schema. Ownership check. |
| DELETE `/api/videos/:videoId` | `protect, creatorOrAdmin` | `deleteVideo` | Ownership or admin. Cascade. |
| GET `/api/videos/by-channel/:userId` | `optionalAuth` | `getByChannel` | Public ready+public videos by user. |

### `listVideos` controller logic

```ts
import type { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import type { ListVideoQuery } from '@shared/schemas/video.schema.js';
import type { ApiResponse, PaginatedResponse } from '@shared/types/api.js';
import type { VideoDTO } from '@shared/types/video.js';
import { Video, type VideoSchemaType } from '../models/Video.js';
import { escapeRegex } from '../utils/escapeRegex.js';

export const listVideos = async (
  req: Request<unknown, unknown, unknown, ListVideoQuery>,
  res: Response<ApiResponse<PaginatedResponse<VideoDTO>>>,
): Promise<void> => {
  const query = (req as unknown as { validatedQuery: ListVideoQuery }).validatedQuery;
  const { q, tag, sort, page, limit } = query;
  const filter: FilterQuery<VideoSchemaType> = { status: 'ready', visibility: 'public' };
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: re }, { description: re }, { tags: re }];
  }
  if (tag) filter.tags = tag;

  const sortMap = { new: '-createdAt', top: '-views', liked: '-likeCount' } as const;
  const total = await Video.countDocuments(filter);
  const items = await Video.find(filter)
    .sort(sortMap[sort])
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('author', 'username displayName subscriberCount')
    .lean();

  res.json({
    success: true,
    data: {
      items: items as unknown as VideoDTO[],
      page,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
};
```

`sortMap` is `as const` so `sortMap[sort]` is a string literal type — the compiler verifies `sort` is one of the keys.

### `getVideoById` logic

- Find by `videoId` field.
- If not found → 404.
- If `status !== 'ready'` or `visibility !== 'public'`: only allow if `req.user?._id.equals(video.author)` or `req.user?.role === 'admin'`.
- Return populated video.

### `updateVideo` logic — ownership + mass assignment guard

```ts
const video = await Video.findOne({ videoId: req.params.videoId });
if (!video) {
  res.status(404).json({ success: false, message: 'Not found' });
  return;
}
const isOwner = req.user && video.author.equals(req.user._id);
if (!isOwner && req.user?.role !== 'admin') {
  res.status(403).json({ success: false, message: 'Forbidden' });
  return;
}
Object.assign(video, req.body); // body is already validated UpdateVideoInput
await video.save();
res.json({ success: true, data: video });
```

### `deleteVideo`

Same ownership pattern. After DB delete, recursively remove `processed/<videoId>/` folder from disk via `fs.promises.rm(dir, { recursive: true, force: true })`. Cascade-delete `Comment`, `Like`, `View` documents matching `video: video._id`.

**SECURITY:**
- Pagination clamped at the schema layer: `limit ≤ 48`, `page ≥ 1`.
- Search uses `escapeRegex` — no ReDoS surface.
- Public list excludes non-`ready` and non-`public` videos at the DB filter level.
- Detail endpoint enforces same visibility rules.
- Update controller body is `UpdateVideoInput` — `views`, `likeCount`, `author`, `status`, `videoId` cannot be passed because they're not in the type.
- Delete cleans up filesystem AND related collections — no orphans.

---

## STEP 11 — HLS Streaming Route & Range-Aware Static Serving

HLS streaming is just serving a `.m3u8` text file plus a sequence of `.ts` segments. React Player + HLS.js fetches them in order.

**Mount in `server/src/index.ts`** (already shown in STEP 5):

```ts
app.use(
  '/api/stream',
  express.static(path.resolve(env.UPLOAD_DIR_PROCESSED), {
    fallthrough: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.m3u8')) res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      if (filePath.endsWith('.ts')) res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', env.CLIENT_ORIGIN);
    },
  }),
);
```

**Resulting URLs:**
- `GET /api/stream/<videoId>/index.m3u8` → playlist
- `GET /api/stream/<videoId>/000.ts`, `001.ts`, ... → segments
- `GET /api/stream/<videoId>/thumbnail.jpg` → thumbnail

**Why static?** HLS segments are small, immutable, and benefit from HTTP caching + CDN edge caching. Range requests are handled natively by `express.static` for video segments.

**Optional gated wrapper** — for `unlisted` videos, the playlist URL still works because HLS players need direct file access; obfuscation comes from the `nanoid` `videoId`.

**Thumbnail URL helper** — client uses `${API_URL}/api/stream/${videoId}/thumbnail.jpg`. Stored DB path `processed/<videoId>/thumbnail.jpg` is converted at the API serializer level so the client gets a ready-to-render absolute or root-relative URL.

**SECURITY:**
- `fallthrough: false` returns 404 (not next middleware) for missing files.
- `path.resolve` ensures the static root is canonical — `..` traversal is blocked by `express.static`.
- Cache headers are aggressive (segments are immutable once written).
- CORS header set per-response so browsers fetch HLS chunks from a different origin during dev.
- No directory listing — `express.static` does not enable indexing by default.

---

## STEP 12 — View Counter, Watch History & Deduplication

A naive counter that increments on every page load is gameable. FRAGMENT uses a simple deduplication strategy.

### `server/src/models/View.ts`

```ts
import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';

const viewSchema = new Schema(
  {
    video: { type: Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    fingerprint: { type: String, required: true },
  },
  { timestamps: true },
);

viewSchema.index({ video: 1, user: 1, createdAt: -1 });
viewSchema.index({ video: 1, fingerprint: 1, createdAt: -1 });

export type ViewSchemaType = InferSchemaType<typeof viewSchema>;
export type ViewDoc = HydratedDocument<ViewSchemaType>;
export const View = model('View', viewSchema);
```

**Endpoint:** `PATCH /api/videos/:videoId/view` — middleware `optionalAuth, validate(viewBodySchema)`.

**Controller logic:**

1. Find video (must be `ready+public`, else 404).
2. Determine identity: `userId = req.user?._id` OR `fingerprint = req.body.fingerprint` (validated UUID).
3. Look for an existing `View` for this `(video, identity)` pair within the last 30 minutes.
4. If found → return `{ counted: false, views: video.views }`.
5. If not → create new `View` doc, atomically `Video.findByIdAndUpdate(video._id, { $inc: { views: 1 } }, { new: true })`. If author known, also `User.findByIdAndUpdate(authorId, { $inc: { totalViews: 1 } })`. Return `{ counted: true, views: updated.views }`.

**Watch history endpoint:** `GET /api/users/me/history` — protected. Returns the latest 50 distinct videos the user has viewed, populated. Respects `preferences.privacy.showHistory` only on the public profile.

**Frontend usage:** When VideoDetailPage mounts and the player has loaded the first segment (`onReady`), call `videoService.recordView(videoId)`. Anonymous users send a stable `fingerprint` from `useGuestFingerprint()` hook (UUID stored in `localStorage` under `fragment:fingerprint`).

**SECURITY:**
- 30-minute deduplication window prevents view inflation via reload spam.
- Anonymous fingerprint is client-controlled but combined with rate limiting and the dedup window it's "good enough" for an MVP.
- Author view counters update atomically with `$inc`.
- Watch history endpoint is protected and only returns own history.
- `viewBodySchema` enforces `fingerprint` as `z.string().uuid()` — invalid format rejected before controller runs.

---

## STEP 13 — Likes / Dislikes System

### `server/src/models/Like.ts`

```ts
import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';
import { LIKE_VALUES } from '@shared/constants/enums.js';

const likeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    video: { type: Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    value: { type: Number, enum: LIKE_VALUES, required: true },
  },
  { timestamps: true },
);

likeSchema.index({ user: 1, video: 1 }, { unique: true });

export type LikeSchemaType = InferSchemaType<typeof likeSchema>;
export type LikeDoc = HydratedDocument<LikeSchemaType>;
export const Like = model('Like', likeSchema);
```

### Shared schema

```ts
// shared/schemas/like.schema.ts
import { z } from 'zod';
import { LIKE_VALUES } from '../constants/enums.js';

export const setReactionSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]).refine((v) => LIKE_VALUES.includes(v as 1 | -1)),
});
export type SetReactionInput = z.infer<typeof setReactionSchema>;
```

### Endpoints

| Method + Path | Middleware | Controller | Behavior |
|---|---|---|---|
| POST `/api/likes/:videoId` | `protect, validate(setReactionSchema)` | `setReaction` | Body: `{ value: 1 \| -1 }`. Upsert. If existing doc has same value → delete it (toggle off). Update `Video.likeCount` / `dislikeCount` denormalized counters atomically. |
| DELETE `/api/likes/:videoId` | `protect` | `removeReaction` | Remove user's reaction, decrement appropriate counter. |
| GET `/api/likes/:videoId/me` | `optionalAuth` | `getMyReaction` | Returns `{ value: 1 \| -1 \| 0 }` for current user. |

**Counter consistency strategy:** every reaction change wraps in a transaction OR uses a 2-step `$inc` with awareness of what was there before. For MVP simplicity, accept eventual consistency and run a nightly `recountLikes()` script (mention in README as "future").

**SECURITY:**
- Auth required to like/dislike.
- Reaction is per-`(user, video)` pair via unique index — no double-likes possible at DB level.
- `value` is strictly typed as `1 | -1` via shared Zod schema; runtime AND compile time enforced.
- Counter updates are atomic `$inc` operations.

---

## STEP 14 — Comments & Nested Replies

### `server/src/models/Comment.ts`

```ts
import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';

const commentSchema = new Schema(
  {
    video: { type: Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    body: { type: String, required: true, minlength: 1, maxlength: 1000, trim: true },
    isEdited: { type: Boolean, default: false, required: true },
    isDeleted: { type: Boolean, default: false, required: true },
    replyCount: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

commentSchema.index({ video: 1, parent: 1, createdAt: -1 });

export type CommentSchemaType = InferSchemaType<typeof commentSchema>;
export type CommentDoc = HydratedDocument<CommentSchemaType>;
export const Comment = model('Comment', commentSchema);
```

### Shared schema

```ts
// shared/schemas/comment.schema.ts
import { z } from 'zod';

export const createCommentSchema = z.object({
  videoId: z.string().min(1),
  body: z.string().min(1).max(1000).trim(),
  parent: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const editCommentSchema = z.object({ body: z.string().min(1).max(1000).trim() });
export type EditCommentInput = z.infer<typeof editCommentSchema>;
```

### Endpoints

| Method + Path | Middleware | Controller |
|---|---|---|
| GET `/api/comments/video/:videoId` | `optionalAuth` | `listForVideo` |
| GET `/api/comments/:commentId/replies` | `optionalAuth` | `listReplies` |
| POST `/api/comments` | `protect, commentLimiter, validate(createCommentSchema)` | `createComment` |
| PATCH `/api/comments/:commentId` | `protect, validate(editCommentSchema)` | `editComment` |
| DELETE `/api/comments/:commentId` | `protect` | `deleteComment` |

**`listForVideo`** — only top-level (`parent: null`), paginated, sort `-createdAt`, populate `author` (`username displayName`). Soft-deleted comments returned with `body: '[deleted]'` and `author: null`.

**`createComment`** — verify video exists and is `ready+public`. If `parent`, verify parent belongs to same video. Create. If reply, `$inc replyCount` on parent. `$inc commentCount` on video.

**`editComment`** — ownership only. Set `isEdited: true`.

**`deleteComment`** — owner OR admin OR video author can delete. Soft delete: `isDeleted: true`, `body: ''`. Decrement counters.

**SECURITY:**
- `parent` is verified to belong to the same video — prevents cross-video reply forgery.
- Body length capped server-side; XSS prevented by React JSX auto-escape on render. Zod `.trim()` strips leading/trailing whitespace.
- Soft delete preserves thread structure without exposing original text.
- Edit reserved to author; delete extended to video author and admin.
- Rate limiter caps 10 comments/min/IP.

---

## STEP 15 — Channel Profile, Subscriptions & Recommendation Feed

### `server/src/models/Subscription.ts`

```ts
import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';

const subscriptionSchema = new Schema(
  {
    subscriber: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channel: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

export type SubscriptionSchemaType = InferSchemaType<typeof subscriptionSchema>;
export type SubscriptionDoc = HydratedDocument<SubscriptionSchemaType>;
export const Subscription = model('Subscription', subscriptionSchema);
```

### Endpoints

| Method + Path | Middleware | Controller |
|---|---|---|
| POST `/api/subscriptions/:channelId` | `protect` | `subscribe` |
| DELETE `/api/subscriptions/:channelId` | `protect` | `unsubscribe` |
| GET `/api/subscriptions/me` | `protect` | `myChannels` |
| GET `/api/subscriptions/me/feed` | `protect` | `subscriptionFeed` |
| GET `/api/subscriptions/:channelId/status` | `optionalAuth` | `isSubscribed` |

**`subscribe`** — reject self-subscribe (`channelId === req.user._id` → 400). Create subscription. `$inc User.subscriberCount` on channel (atomic). Return updated subscriber count.

**`subscriptionFeed`** — get list of channel IDs user subscribed to → fetch latest `ready+public` videos from those channels, sort `-createdAt`, paginate (default limit 24).

**Recommendation logic** (used by VideoDetailPage right rail) — `GET /api/videos/:videoId/recommendations?limit=8`:

- Fetch the video's `author`.
- Return latest 4 OTHER videos by the same author + 4 newest videos overall (excluding current).
- All filtered to `ready+public`.

**Channel profile endpoint:** `GET /api/users/:username` — public.
- Find user by `username`.
- Returns `PublicUserDTO` from `@shared/types/user.ts` — `email`, `password`, `preferences`, `isBanned`, `lastLoginAt` are NOT in the type, so the controller's `res.json()` is type-checked.

**SECURITY:**
- Self-subscribe blocked at controller.
- Unique index prevents duplicate subscriptions even on race conditions.
- Subscription feed only returns `ready+public` videos.
- Public profile endpoint never returns `email`, `password`, `preferences`, `isBanned`, or `lastLoginAt` — TS `Pick<>` enforces this in the response type.

---

## STEP 16 — User Profile & Preferences

Already partly covered by STEP 6's auth controller. This step adds preferences + creator promotion + public profile aggregations.

### Endpoints (`server/src/routes/user.routes.ts`)

| Method + Path | Middleware | Controller |
|---|---|---|
| GET `/api/users/:username` | `optionalAuth` | `getPublicProfile` |
| GET `/api/users/me/preferences` | `protect` | `getPreferences` |
| PATCH `/api/users/me/preferences` | `protect, validate(updatePreferencesSchema)` | `updatePreferences` |
| POST `/api/users/me/become-creator` | `protect` | `becomeCreator` |
| GET `/api/users/me/history` | `protect` | `watchHistory` (defined STEP 12) |

### `shared/schemas/user.schema.ts`

```ts
import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(48).optional(),
  bio: z.string().max(280).optional(),
  bannerUrl: z.string().url().optional().nullable(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    accentColor: z.enum(['acid', 'magenta', 'electric', 'orange']).optional(),
    fontSize: z.enum(['sm', 'md', 'lg']).optional(),
    density: z.enum(['compact', 'comfortable']).optional(),
    animations: z.enum(['full', 'reduced', 'off']).optional(),
    scanlines: z.boolean().optional(),
    privacy: z
      .object({
        showEmail: z.boolean().optional(),
        showHistory: z.boolean().optional(),
        showSubscriptions: z.boolean().optional(),
      })
      .partial()
      .optional(),
    notifications: z
      .object({
        newSubscriber: z.boolean().optional(),
        newComment: z.boolean().optional(),
      })
      .partial()
      .optional(),
    content: z
      .object({
        autoplay: z.boolean().optional(),
        defaultVolume: z.number().min(0).max(1).optional(),
      })
      .partial()
      .optional(),
  })
  .strict();
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
```

`.strict()` rejects unknown keys at validation time — no silent injection.

**`updatePreferences`** — Use `$set` with dot-notation paths so partial nested updates work:

```ts
const flatten = (obj: object, prefix = ''): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, `preferences.${k}`));
    } else {
      out[`preferences.${key}`] = v;
    }
  }
  return out;
};
```

**`becomeCreator`** — if `req.user.role === 'viewer'`, set to `creator`. If already `creator` or `admin`, return current user unchanged. Cannot demote self via this endpoint.

**SECURITY:**
- Preferences endpoint validates EVERY field via Zod `.strict()` — unknown keys throw 422.
- Public profile selectively returns only safe fields via `PublicUserDTO`.
- `becomeCreator` is one-way and self-only; demotion requires admin endpoint.

---

## STEP 17 — Admin API: Dashboard, User & Video Moderation

**`server/src/routes/admin.routes.ts`** — all routes mounted under `/api/admin`, all protected by `adminLimiter, protect, adminOnly`.

| Method + Path | Controller | Behavior |
|---|---|---|
| GET `/dashboard/stats` | `getDashboardStats` | Aggregate: totalUsers, totalVideos, totalViews, totalComments, videosByStatus, newUsersLast7Days, topVideosByViews (5). |
| GET `/users` | `listUsers` | Paginated, search by `username` or `email`, filter by `role`, sort. |
| PATCH `/users/:userId/role` | `setUserRole` | Body `{ role }`. Cannot change own role. Cannot demote the last admin. |
| PATCH `/users/:userId/ban` | `toggleBan` | Body `{ isBanned }`. Cannot ban self. |
| DELETE `/users/:userId` | `deleteUser` | Cannot delete self. Cannot delete last admin. Cascade everything. |
| GET `/videos` | `listAllVideos` | All videos, all statuses, filter by `status`/`isFlagged`, search title. |
| PATCH `/videos/:videoId/flag` | `flagVideo` | Body `{ isFlagged }`. |
| DELETE `/videos/:videoId` | `adminDeleteVideo` | Same as user delete but bypass ownership. |
| GET `/comments` | `listAllComments` | Paginated, filter by video, search body. |
| DELETE `/comments/:commentId` | `adminDeleteComment` | Soft delete + audit field if desired. |
| GET `/maintenance/disk` | `getDiskUsage` | Returns disk stats — see below. |
| POST `/maintenance/cleanup` | `runCleanup` | Sweeps old failed videos + orphan folders — see below. |

### `shared/schemas/admin.schema.ts`

```ts
import { z } from 'zod';
import { USER_ROLES } from '../constants/enums.js';

export const setRoleSchema = z.object({ role: z.enum(USER_ROLES) });
export const toggleBanSchema = z.object({ isBanned: z.boolean() });
export const flagVideoSchema = z.object({ isFlagged: z.boolean() });
export const cleanupSchema = z.object({
  failedOlderThanDays: z.coerce.number().int().min(1).max(365).default(7),
  dryRun: z.coerce.boolean().default(false),
});
```

### Last-admin protection logic

```ts
if (newRole !== 'admin') {
  const adminCount = await User.countDocuments({ role: 'admin' });
  if (adminCount <= 1 && targetUser.role === 'admin') {
    res.status(400).json({ success: false, message: 'Cannot demote the last admin' });
    return;
  }
}
```

### Disk Usage Endpoint — `GET /api/admin/maintenance/disk`

Critical for the Fly.io 3 GB free volume. Returns `DiskUsageReport` from `@shared/types/admin.ts`:

```ts
// shared/types/admin.ts
export type DiskAlertLevel = 'ok' | 'warn' | 'critical';

export type DiskUsageReport = {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  videoCount: number;
  rawCount: number;
  dbVideoCount: number;
  orphanFolderCount: number;
  dbOrphanCount: number;
  quotaMb: number;
  alertLevel: DiskAlertLevel;
};

export type CleanupReport = {
  dryRun: boolean;
  failedVideosDeleted: number;
  orphanFoldersDeleted: number;
  missingHlsMarkedFailed: number;
  staleRawDeleted: number;
  bytesFreed: number;
};
```

Implementation uses `fs.promises.readdir` + `fs.promises.stat` recursively. Cache result for 30 seconds (in-memory) to avoid expensive disk walks on every dashboard load.

### Cleanup Endpoint — `POST /api/admin/maintenance/cleanup`

Body validated by `cleanupSchema`.

**Sweep logic (executed in order):**

1. **Failed videos:** Find `Video.find({ status: 'failed', updatedAt: { $lt: new Date(Date.now() - days * 86_400_000) } })`. For each: delete DB doc + `processed/<videoId>/` folder if it exists.
2. **Orphan folders on disk:** For each subfolder in `processed/`, if no corresponding `Video` doc exists in DB → delete folder.
3. **Orphan DB records:** For each `Video` with `status: 'ready'` whose `processed/<videoId>/index.m3u8` is missing → mark as `failed` with `processingError: 'HLS files missing on disk'`.
4. **Stale raw uploads:** Delete files in `uploads/raw/` older than 1 hour.

Returns `CleanupReport`.

**Manual trigger from Fly.io shell:**

```bash
fly ssh console -C "curl -X POST -H 'Authorization: Bearer <admin-token>' http://localhost:3000/api/admin/maintenance/cleanup"
```

**SECURITY:**
- ALL admin routes triple-guarded (limiter + protect + adminOnly).
- Self-protection on role change, ban, and delete.
- Last-admin protection on demote and delete.
- Cascade deletes clean videos, comments, likes, subscriptions, views, AND filesystem HLS folders.
- Cleanup endpoint **never** deletes `ready` videos; `dryRun` lets admin preview impact.
- Disk endpoint exposes server filesystem details — admin-only by design.

---

## STEP 18 — Backend Validation, Sanitization & Security Audit

### Zod-based validation runner — recap

The `validate(schema, source?)` middleware from STEP 9 is the ONLY validation pattern in the codebase. There is no `express-validator`. Schemas live in `@shared/schemas/*` and are consumed by both server validation and client form types via `z.infer<>`.

### Comprehensive Security Audit Checklist

- [ ] **Mass assignment:** every controller body type comes from a Zod-inferred shape; no `req.body as any` spread into models.
- [ ] **Role protection:** `role` is NOT defined on `RegisterInput`, `UpdateProfileInput`, or any non-admin schema — TS makes it impossible to read.
- [ ] **User enumeration:** login returns identical `'Invalid email or password'` for unknown email and wrong password; register duplicate is generic.
- [ ] **Password security:** bcrypt with rounds 12; field has `select: false`; never returned in any API response; password change requires `currentPassword`; account deletion requires password.
- [ ] **JWT secret:** min 32 chars enforced at startup in production via Zod `superRefine`.
- [ ] **Rate limiters:** separate instances for `globalLimiter`, `authLimiter`, `uploadLimiter`, `commentLimiter`, `adminLimiter`.
- [ ] **Helmet enabled** on all responses.
- [ ] **CORS** strict to `env.CLIENT_ORIGIN`, never `*` in production.
- [ ] **Body limits:** `express.json({ limit: '50kb' })` and `urlencoded({ limit: '50kb' })` set.
- [ ] **mongo-sanitize:** custom middleware applies `.sanitize()` only to `req.body` and `req.params`.
- [ ] **Express 5:** no code assigns to `req.query`. `hpp` is NOT installed.
- [ ] **XSS:** every text input passes through Zod `.trim()` + React JSX auto-escape on render.
- [ ] **ReDoS:** all user-controlled regex inputs run through `escapeRegex`.
- [ ] **Ownership:** every update/delete on `Video`, `Comment` verifies `author === req.user._id` OR admin.
- [ ] **Published-only:** public list/detail/recommendations/feed return ONLY `status: 'ready'` AND `visibility: 'public'`.
- [ ] **Pagination clamp:** `limit ≤ 48`, `page ≥ 1` enforced via `listVideoQuerySchema`.
- [ ] **File upload:** MIME whitelist enforced via `Set<string>` lookup; size capped via `MAX_UPLOAD_SIZE_MB`; filenames server-generated via nanoid.
- [ ] **Admin self-protection:** cannot ban, demote, or delete self; last admin cannot be demoted/deleted.
- [ ] **Cascade deletes:** user delete removes their videos (DB + disk), comments, likes, subscriptions, views; video delete removes its comments, likes, views, and HLS folder; comment delete decrements counters.
- [ ] **Error handler:** in production, no stack traces, no Mongoose field hints, no internal paths.
- [ ] **Privacy:** `preferences.privacy.showHistory`, `showSubscriptions` enforced server-side on relevant public endpoints.
- [ ] **x-powered-by disabled** via `app.disable('x-powered-by')`.
- [ ] **`.env.example` synced** with every variable; NO real secrets.
- [ ] **No `console.log`** of sensitive data in production code.
- [ ] **Tokens** stored client-side in `localStorage` only.
- [ ] **Mongoose 8:** every `pre`/`post` hook is `async function()` without `next` parameter.
- [ ] **Path traversal:** all filesystem paths derived from `videoId` (nanoid) only.
- [ ] **HLS static** has `fallthrough: false`.
- [ ] **View counter dedup:** 30-min window prevents inflation; anonymous fingerprint is UUID-validated via Zod.
- [ ] **Subscription:** self-subscribe blocked; unique index prevents duplicates.
- [ ] **Reaction:** `value` strictly `1 \| -1` via Zod literal union; one-per-user-per-video enforced via unique index.
- [ ] **Duration cap:** FFprobe pre-flight check rejects videos longer than `MAX_VIDEO_DURATION_SECONDS`.
- [ ] **Disk hygiene:** `processVideo` `finally` always unlinks raw file; failed transcodes also `rm -rf` partial folders; admin cleanup endpoint sweeps stale failed videos.
- [ ] **Maintenance endpoints:** `/api/admin/maintenance/*` are admin-only; cleanup never deletes `ready` videos; `dryRun` preview supported.
- [ ] **TypeScript strictness:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all on. No `any` leaks.
- [ ] **Shared schemas:** server validation and client form validation use the SAME Zod schema — no drift possible.

---

## STEP 19 — Client Scaffolding: Vite, Tailwind v4, Axios, Custom Hooks, Contexts

### `client/tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "useDefineForClassFields": true,
    "allowImportingTsExtensions": false,
    "noEmit": true,
    "composite": true,
    "types": ["vite/client"]
  },
  "references": [{ "path": "../shared" }, { "path": "./tsconfig.node.json" }],
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

### `client/tsconfig.node.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "composite": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

### `client/vite.config.ts`

```ts
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
```

### `client/src/types/env.d.ts`

```ts
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MAX_UPLOAD_SIZE_MB: string;
  readonly VITE_MAX_VIDEO_DURATION_SECONDS: string;
  readonly VITE_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`.env.example`: `VITE_API_URL=http://localhost:5000`, `VITE_MAX_UPLOAD_SIZE_MB=500`, `VITE_MAX_VIDEO_DURATION_SECONDS=600`.

### `client/src/api/axios.ts`

```ts
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const surfaceRateLimitWarning = (() => {
  let lastWarnAt = 0;
  return (headers: Record<string, string | undefined>): void => {
    const remaining = Number(headers['ratelimit-remaining']);
    if (!Number.isFinite(remaining) || remaining > 4) return;
    if (Date.now() - lastWarnAt < 5000) return;
    lastWarnAt = Date.now();
    toast(`// ${remaining} REQUESTS LEFT // SLOW DOWN`, { icon: '!!' });
  };
})();

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('fragment:token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => {
    surfaceRateLimitWarning(r.headers as Record<string, string | undefined>);
    return r;
  },
  (err: unknown) => {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) {
        localStorage.removeItem('fragment:token');
        if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
      }
      if (err.response?.status === 429) {
        const retryAfter = Number(err.response.headers['retry-after']) || 60;
        toast.error(`// THROTTLED // RETRY IN ${retryAfter}s`);
      }
      const requestId = (err.response?.data as { requestId?: string } | undefined)?.requestId;
      if (requestId) (err as Error & { requestId?: string }).requestId = requestId;
    }
    return Promise.reject(err);
  },
);

export default api;
```

When an error has a `requestId` attached, error UIs show it in small mono type beneath the message: `// REF: a3f8-2c1b-...` — copy-pasteable for `fly logs`.

### Service files (`client/src/services/*.service.ts`)

One per resource. Each exports named async functions that wrap `api.get/post/patch/delete` calls, **typed against `@shared/types/*`**.

Example:

```ts
// client/src/services/auth.service.ts
import api from '../api/axios.js';
import type { ApiResponse } from '@shared/types/api.js';
import type { AuthResponse, UserDTO } from '@shared/types/user.js';
import type { RegisterInput, LoginInput } from '@shared/schemas/auth.schema.js';

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const { data } = await api.post<ApiResponse<AuthResponse>>('/api/auth/register', input);
  if (!data.success) throw new Error(data.message);
  return data.data;
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const { data } = await api.post<ApiResponse<AuthResponse>>('/api/auth/login', input);
  if (!data.success) throw new Error(data.message);
  return data.data;
};

export const getMe = async (): Promise<UserDTO> => {
  const { data } = await api.get<ApiResponse<UserDTO>>('/api/auth/me');
  if (!data.success) throw new Error(data.message);
  return data.data;
};

// updateProfile, changePassword, deleteAccount follow the same pattern
```

| File | Functions |
|---|---|
| `auth.service.ts` | `register`, `login`, `getMe`, `updateProfile`, `changePassword`, `deleteAccount` |
| `video.service.ts` | `listVideos`, `getVideo`, `getStatus`, `getMyVideos`, `getByChannel`, `getRecommendations`, `updateVideo`, `deleteVideo`, `recordView`, `uploadVideo` (with `onUploadProgress` config arg) |
| `comment.service.ts` | `listForVideo`, `listReplies`, `createComment`, `editComment`, `deleteComment` |
| `like.service.ts` | `setReaction`, `removeReaction`, `getMyReaction` |
| `subscription.service.ts` | `subscribe`, `unsubscribe`, `myChannels`, `subscriptionFeed`, `isSubscribed` |
| `user.service.ts` | `getPublicProfile`, `getPreferences`, `updatePreferences`, `becomeCreator`, `watchHistory` |
| `admin.service.ts` | `getStats`, `listUsers`, `setUserRole`, `toggleBan`, `deleteUser`, `listAllVideos`, `flagVideo`, `adminDeleteVideo`, `listAllComments`, `adminDeleteComment` |

### Custom hooks (`client/src/hooks/`)

```ts
// useLocalStorage.ts
import { useCallback, useEffect, useState } from 'react';

export const useLocalStorage = <T,>(key: string, defaultValue: T): [T, (v: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded — silent */ }
  }, [key, value]);

  const set = useCallback((v: T) => setValue(v), []);
  return [value, set];
};
```

- `useDebounce<T>(value: T, delay: number): T` — for search input.
- `useReducedMotion(): boolean` — reads `window.matchMedia('(prefers-reduced-motion: reduce)')` + the user's `preferences.animations` setting.
- `useUploadProgress()` — encapsulates `{ progress, isUploading, error, start, reset }`.
- `useGuestFingerprint(): string` — returns/creates a UUID stored in `localStorage` under `fragment:fingerprint`.

### `client/src/context/AuthContext.tsx`

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserDTO } from '@shared/types/user.js';
import type { LoginInput, RegisterInput } from '@shared/schemas/auth.schema.js';
import * as authService from '../services/auth.service.js';

type AuthState = {
  user: UserDTO | null;
  token: string | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<UserDTO>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('fragment:token'),
    loading: true,
  });

  useEffect(() => {
    if (!state.token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    authService
      .getMe()
      .then((user) => setState({ user, token: state.token, loading: false }))
      .catch(() => {
        localStorage.removeItem('fragment:token');
        setState({ user: null, token: null, loading: false });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = state.user?.role === 'admin';
    return {
      ...state,
      isAuthenticated: state.user !== null,
      isAdmin,
      isCreator: state.user?.role === 'creator' || isAdmin,
      login: async (input) => {
        const { user, token } = await authService.login(input);
        localStorage.setItem('fragment:token', token);
        setState({ user, token, loading: false });
      },
      register: async (input) => {
        const { user, token } = await authService.register(input);
        localStorage.setItem('fragment:token', token);
        setState({ user, token, loading: false });
      },
      logout: () => {
        localStorage.removeItem('fragment:token');
        setState({ user: null, token: null, loading: false });
      },
      updateUser: (partial) => setState((s) => (s.user ? { ...s, user: { ...s.user, ...partial } } : s)),
    };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

### `client/src/context/PreferencesContext.tsx`

- State: full `UserPreferences` object (default from `@shared/types/user.ts`).
- Effect: when user changes, fetch their preferences (or use defaults for guests; persist guest prefs in localStorage under `fragment:prefs`).
- Apply theme to `<html>` class — `light` / `dark` / `system` (use `matchMedia` for system, with `change` listener cleanup).
- Apply `data-density`, `data-fontsize`, `data-accent`, `data-scanlines`, `data-motion` attributes on `<html>` so CSS can react.
- `updatePreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K])` — typed setter.

**SECURITY (client):**
- No `dangerouslySetInnerHTML` anywhere.
- Token stored in `localStorage` (acceptable for SPA MVP).
- Axios 401 interceptor purges token + redirects.
- Error messages from API surfaced via toast — never raw error objects exposed to UI.
- The `useAuth` hook throws if used outside `AuthProvider` — TS prevents the `null` context value from leaking into components.

---

## STEP 20 — Brutalist Design System: Tokens, Primitives, Glitch Effects

**`client/src/index.css`:**

```css
@import "tailwindcss";

@theme {
  --color-bone: #F4F1EA;
  --color-ink: #0A0A0A;
  --color-acid: #B9FF66;
  --color-magenta: #FF2D87;
  --color-electric: #2D5BFF;
  --color-orange: #FF5B1F;
  --color-phosphor: #00FF9C;
  --font-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace;
  --font-display: "Space Grotesk", "Inter", system-ui, sans-serif;
  --shadow-brutal: 4px 4px 0 #0A0A0A;
  --shadow-brutal-sm: 2px 2px 0 #0A0A0A;
}

@layer base {
  html { font-family: var(--font-mono); background: var(--color-bone); color: var(--color-ink); }
  html.dark { background: #000; color: var(--color-bone); }
  html[data-fontsize="sm"] { font-size: 14px; }
  html[data-fontsize="lg"] { font-size: 18px; }
  html[data-density="compact"] { --pad: 0.5rem; }
  html[data-density="comfortable"] { --pad: 1rem; }
  html[data-motion="off"] *, html[data-motion="reduced"] * { animation: none !important; transition: none !important; }
  ::selection { background: var(--color-acid); color: var(--color-ink); }
}
```

**Scanline overlay:**

```css
html[data-scanlines="true"]::after {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 9999;
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.05) 2px 3px);
  mix-blend-mode: multiply;
}
```

**Glitch hover keyframe:**

```css
@keyframes rgb-split {
  0%   { text-shadow: 0 0 0 var(--color-magenta), 0 0 0 var(--color-electric); }
  20%  { text-shadow: -2px 0 0 var(--color-magenta), 2px 0 0 var(--color-electric); }
  40%  { text-shadow: 1px 0 0 var(--color-magenta), -1px 0 0 var(--color-electric); }
  100% { text-shadow: 0 0 0 transparent, 0 0 0 transparent; }
}
.glitch:hover { animation: rgb-split 220ms steps(2, end); }
```

**Brutalist primitives (`client/src/components/brutal/`)** — each is a typed FC.

```tsx
// BrutalButton.tsx
import { type ButtonHTMLAttributes, type ElementType, type ReactNode } from 'react';

type Variant = 'solid' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type BrutalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  as?: ElementType;
  children: ReactNode;
};

export const BrutalButton = ({
  variant = 'solid',
  size = 'md',
  as: Tag = 'button',
  children,
  className = '',
  ...rest
}: BrutalButtonProps) => {
  const base = 'border-2 border-ink uppercase font-mono tracking-tight transition-none';
  const variants: Record<Variant, string> = {
    solid: 'bg-acid text-ink shadow-(--shadow-brutal) hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
    outline: 'bg-transparent text-ink hover:bg-ink hover:text-bone',
    danger: 'bg-orange text-ink shadow-(--shadow-brutal) hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
  };
  const sizes: Record<Size, string> = { sm: 'px-3 py-1 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg' };
  return (
    <Tag className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      [ {children} ]
    </Tag>
  );
};
```

The other primitives follow the same pattern:

| Component | Props | Visual |
|---|---|---|
| `BrutalInput` | `label?, error?, prefix?` + native input attrs | Monospace, 2px border, no rounded corners. Error state turns border `--color-orange`. |
| `BrutalCard` | `accent?, hoverable?, children` | Border + shadow. Hoverable cards translate on hover. |
| `BrutalBadge` | `tone: 'ink'\|'acid'\|'magenta'\|'electric'\|'orange'` | Rectangular pill. |
| `BrutalModal` | `open: boolean, onClose: () => void, title: string, children` | Fullscreen backdrop, centered card with 4px border. |
| `BrutalToggle` | `checked: boolean, onChange: (v: boolean) => void, label: string` | `[X]` / `[ ]` squares. |
| `BrutalDivider` | `label?: string` | Horizontal line with optional centered ALL-CAPS label `// SECTION //`. |

**Decorative typography rules** to apply across all pages:
- Section titles use the format `// SECTION_NAME` or `[ SECTION_NAME ]`.
- Numeric metrics use tabular-nums and trailing arrow `123 -->` for emphasis.
- Status pills always uppercase: `[ PROCESSING ]`, `[ READY ]`, `[ FAILED ]`.

**Toast styling (react-hot-toast)** — override config in App root: 2px black border, no rounded corners, `--shadow-brutal`, monospace font.

**SECURITY:** All glitch animations gated behind `useReducedMotion()` — respects OS and user preference.

---

## STEP 21 — App Routing & Layout Shells

This step wires the React Router tree, defines the three layout components that frame every page, and installs the route guards that enforce authentication and role-based access at the URL level.

### Layout Components

**`MainLayout.tsx`:** `<Navbar />` + `<main className="min-h-[80vh]"><Outlet /></main>` + `<Footer />`. Optional `<ScanlineOverlay />` hooked from preferences. Used by every public + authenticated page that isn't admin or settings.

**`AdminLayout.tsx`:** Sidebar (left, 240px, ink background, acid links) + content area. Mobile: sidebar collapses to top sheet via hamburger. Sidebar links: Dashboard, Users, Videos, Comments. Wraps the four admin pages.

**`SettingsLayout.tsx`:** Left column with section tabs (Profile, Account, Appearance, Privacy, Notifications). Mobile: tabs become a `<select>` dropdown. Wraps the five settings sub-pages.

### `App.tsx` Routes

Routes are defined as a typed array; each entry is `{ path, element, guard? }`. The router is React Router v7's `createBrowserRouter`.

| Path | Component | Guard |
|---|---|---|
| `/` | `HomePage` | none |
| `/login` | `LoginPage` | `GuestOnlyRoute` |
| `/register` | `RegisterPage` | `GuestOnlyRoute` |
| `/v/:videoId` | `VideoDetailPage` | none |
| `/upload` | `UploadPage` | `CreatorRoute` |
| `/studio` | `StudioPage` | `CreatorRoute` |
| `/c/:username` | `ChannelPage` | none |
| `/me` | `ProfilePage` | `ProtectedRoute` |
| `/me/history` | `HistoryPage` | `ProtectedRoute` |
| `/me/subscriptions` | `SubscriptionsPage` | `ProtectedRoute` |
| `/settings/profile` | `ProfileSettingsPage` | `ProtectedRoute` |
| `/settings/account` | `AccountSettingsPage` | `ProtectedRoute` |
| `/settings/appearance` | `AppearanceSettingsPage` | none (works for guests too) |
| `/settings/privacy` | `PrivacySettingsPage` | `ProtectedRoute` |
| `/settings/notifications` | `NotificationSettingsPage` | `ProtectedRoute` |
| `/admin` | `AdminDashboardPage` | `AdminRoute` |
| `/admin/users` | `AdminUsersPage` | `AdminRoute` |
| `/admin/videos` | `AdminVideosPage` | `AdminRoute` |
| `/admin/comments` | `AdminCommentsPage` | `AdminRoute` |
| `*` | `NotFoundPage` | none |

### Routing Guards

```tsx
// guards/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { AsciiSpinner } from '../feedback/AsciiSpinner.js';

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <AsciiSpinner />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" state={{ from: loc.pathname }} replace />;
};
```

All guards consume `useAuth()`. While `loading === true`, render an `AsciiSpinner` (no flash of wrong page).

- **`ProtectedRoute`** — redirects guests to `/login`.
- **`GuestOnlyRoute`** — redirects authed users to `/`.
- **`CreatorRoute`** — allows `creator` or `admin`; others get a "Become a creator" CTA card.
- **`AdminRoute`** — allows admin only; others get a 403 visual block.

For typed `useParams`:

```tsx
const { videoId } = useParams<{ videoId: string }>();
if (!videoId) return <NotFoundPage />;
```

`noUncheckedIndexedAccess` makes `videoId` typed as `string | undefined` — the guard above forces handling.

**SECURITY:**
- Loading-aware guards prevent unauthorized page flashes.
- `CreatorRoute` shows a non-blocking CTA rather than throwing.
- `AdminRoute` returns a 403 visual block (not a redirect to login).
- Route guards are a **UX layer**, not a security boundary — the real authorization is enforced server-side by the role middleware (STEP 6).

---

## STEP 22 — Brutalist Navbar & Footer

These two components frame every page in `MainLayout` and define the platform's first-impression visual identity.

### `Navbar.tsx`

- **Left:** logo `[FRAGMENT]` (clickable → home), monospace, oversized (28px on desktop, 22px on mobile), hover triggers glitch animation (gated by `useReducedMotion`).
- **Center (desktop only):** nav links — `// HOME`, `// SUBSCRIPTIONS` (auth only), `// STUDIO` (creator only). Active link gets a 3px ink underline shifted 2px down.
- **Right (desktop):** search input with `>> SEARCH` placeholder, `[ + UPLOAD ]` button (creator only), user avatar dropdown — or `[ LOGIN ]` / `[ REGISTER ]` for guests.
- **Mobile:** hamburger toggles a full-screen overlay menu with thick borders, chunky links (each in its own brutal card), and a manifesto blurb at the bottom.
- **User dropdown items:** `// PROFILE`, `// HISTORY`, `// SETTINGS`, `// ADMIN` (admin only), `// LOGOUT`.
- **Search behavior:** debounced via `useDebounce(value, 350)`. On submit (Enter), navigates to `/?q=<value>`.
- **Sticky positioning:** `position: sticky; top: 0; z-index: 50` with a 2px bottom border.

### `Footer.tsx`

Three columns on desktop:

- **Column 1 — `// FRAGMENT`:** one-line manifesto + small text with build version + commit SHA from `import.meta.env.VITE_COMMIT_SHA` (set during Netlify build, typed in `env.d.ts`).
- **Column 2 — `// LINKS`:** About, GitHub repo (uses `lucide-react` Github icon), License (MIT). Each link prefixed with `>`.
- **Column 3 — `// SYSTEM`:** Theme toggle (`[ LIGHT ] / [ DARK ]`), scanlines toggle (`[ ON ] / [ OFF ]`). Toggles persist via `PreferencesContext`.

**Bottom strip:** centered, full-width, ink background with cream text: `[BUILT WITH FFMPEG // HLS // REACT // TYPESCRIPT]`. 1px top border.

**SECURITY:**
- The commit SHA exposed in the footer is intentional.
- Avatar dropdown reads `user.avatarUrl` directly into an `<img>` tag — backend already validates this is an `https://` URL with no `javascript:` schemes.
- Search input goes through the same NoSQL sanitizer as every other request.

---

## STEP 23 — HTML Head, Open Graph & SEO Meta Tags

The `client/index.html` file gets enriched `<head>` content so that when the portfolio link is shared on LinkedIn, Twitter/X, Discord, Slack, or any messenger, a rich preview card appears with a brutalist thumbnail.

**Why static (not dynamic via React)?** Social media bots **do not execute JavaScript** when scraping for OG tags. They fetch the raw HTML and read the `<head>`. SPAs that try to set OG tags via React or `react-helmet` get **blank previews** because the bot leaves before React mounts.

1. **Default static OG tags** in `client/index.html` covering the home/landing experience.
2. **Optional Netlify pre-rendering plugin** for video detail pages.

**`client/index.html` `<head>` contents** (replace the placeholder Vite scaffolding head):

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0A0A0A" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <title>FRAGMENT // VIDEO SIGNAL</title>
  <meta name="description" content="A brutalist video streaming platform. Upload, transcode to HLS, watch what breaks the frame." />
  <meta name="keywords" content="video streaming, HLS, brutalist, FFmpeg, portfolio, React, Express, TypeScript" />
  <meta name="author" content="<your name>" />

  <!-- Open Graph / Facebook / LinkedIn -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="FRAGMENT" />
  <meta property="og:title" content="FRAGMENT // VIDEO SIGNAL" />
  <meta property="og:description" content="Brutalist video streaming. FFmpeg-powered HLS pipeline. Built as a portfolio piece in TypeScript." />
  <meta property="og:url" content="https://fragment.netlify.app/" />
  <meta property="og:image" content="https://fragment.netlify.app/og-cover.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="FRAGMENT — brutalist video platform cover" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="FRAGMENT // VIDEO SIGNAL" />
  <meta name="twitter:description" content="Brutalist video streaming. FFmpeg-powered HLS pipeline." />
  <meta name="twitter:image" content="https://fragment.netlify.app/og-cover.png" />
  <meta name="twitter:image:alt" content="FRAGMENT — brutalist video platform cover" />

  <!-- Canonical -->
  <link rel="canonical" href="https://fragment.netlify.app/" />
</head>
```

**Required asset — the OG cover image:**

- Path: `client/public/og-cover.png`
- Dimensions: **1200×630 pixels**
- Format: PNG
- File size: keep under 300KB
- Content: Brutalist composition matching the site aesthetic.

**Favicon:** `client/public/favicon.svg` — a 32×32 monochrome SVG.

### Dynamic OG Tags for Video Detail Pages (Optional Bonus)

**Option A — Netlify Prerender (recommended):**

1. In Netlify dashboard → enable **Prerendering**.
2. Install: `npm install react-helmet-async`.
3. Add types: `npm install -D @types/react-helmet-async` (or use the bundled types).
4. In `VideoDetailPage.tsx`:

   ```tsx
   import { Helmet } from 'react-helmet-async';

   {video && (
     <Helmet>
       <title>{video.title} // FRAGMENT</title>
       <meta property="og:type" content="video.other" />
       <meta property="og:title" content={video.title} />
       <meta property="og:description" content={video.description?.slice(0, 200)} />
       <meta property="og:image" content={`${import.meta.env.VITE_API_URL}/api/stream/${video.videoId}/thumbnail.jpg`} />
       <meta property="og:video" content={`${import.meta.env.VITE_API_URL}/api/stream/${video.videoId}/index.m3u8`} />
       <meta property="og:url" content={`https://fragment.netlify.app/v/${video.videoId}`} />
       <meta name="twitter:card" content="summary_large_image" />
       <meta name="twitter:image" content={`${import.meta.env.VITE_API_URL}/api/stream/${video.videoId}/thumbnail.jpg`} />
     </Helmet>
   )}
   ```

5. Wrap `<App />` in `<HelmetProvider>` in `main.tsx`.

**Option B — Skip dynamic OG tags:**

Static defaults from `index.html` cover this case 100% if the portfolio link recruiters share is the homepage URL.

### Verification

- **LinkedIn Post Inspector:** `https://www.linkedin.com/post-inspector/`
- **Twitter Card Validator:** `https://cards-dev.twitter.com/validator`
- **Meta Sharing Debugger (Facebook):** `https://developers.facebook.com/tools/debug/`
- **OpenGraph.xyz** (universal preview): `https://www.opengraph.xyz/`

**SECURITY:**
- OG tags expose only public information.
- The `og:image` URL is a public asset.
- For dynamic video OG tags, only `public + ready` videos surface the metadata.

---

## STEP 24 — Auth Pages: Login & Register

Both pages use the **shared Zod schema** from `@shared/schemas/auth.schema.ts` — the SAME schema the server uses for validation. No drift possible.

### `LoginPage.tsx`

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginSchema, type LoginInput } from '@shared/schemas/auth.schema.js';
import { useAuth } from '../context/AuthContext.js';
import { BrutalButton } from '../components/brutal/BrutalButton.js';
import { BrutalInput } from '../components/brutal/BrutalInput.js';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState<LoginInput>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as keyof LoginInput] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await login(parsed.data);
      const from = (loc.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch {
      toast.error('// INVALID CREDENTIALS');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[480px] border-2 border-ink shadow-(--shadow-brutal) p-8 mt-16">
      <h1 className="text-3xl mb-6">// LOG IN //</h1>
      <BrutalInput label="EMAIL" type="email" prefix=">>" value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} autoComplete="email" />
      <BrutalInput label="PASSWORD" type="password" prefix=">>" value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} autoComplete="current-password" />
      <BrutalButton type="submit" disabled={submitting}>{submitting ? 'AUTHENTICATING...' : 'ENTER'}</BrutalButton>
      <p className="mt-4 text-sm">{'>>'} NEW HERE? <a href="/register" className="underline">[ REGISTER ]</a></p>
    </form>
  );
};
```

### `RegisterPage.tsx`

Same structure with `registerSchema`, fields `username, email, password, confirmPassword`. `confirmPassword` is client-only; the server schema doesn't have it.

**SECURITY:**
- Password input uses `type="password"` with `autoComplete="current-password"` (login) / `"new-password"` (register).
- Client-side `confirmPassword` is UX only — server doesn't trust it.
- Generic error toast for both login and register failures.
- `loginSchema.safeParse` runs on the same Zod schema the server uses → no shape drift between client form and API.

---

## STEP 25 — Discovery Page: Asymmetric Video Grid with Search

**`HomePage.tsx` layout:**
- Top hero strip: oversized text `// FRAGMENT // VIDEO SIGNAL` with subtitle `>> WATCH WHAT BREAKS THE FRAME`.
- Search bar (full-width, mono, prefix `>>`). Debounced 300ms via `useDebounce<string>`.
- Tag chips bar (popular tags, derived client-side from initial fetch). Click toggles tag filter.
- Sort tabs: `[ NEW ] [ TOP ] [ LIKED ]` — typed as `SortOption` from `@shared/constants`.
- **Asymmetric grid:** CSS grid with 12 columns, video cards span variable column counts based on index modulo: e.g., index `% 7 === 0` spans 6 cols, `% 5 === 0` spans 4 cols, default 3 cols.
- Pagination: `[ < PREV ]` `[ NEXT > ]` brutalist buttons + page indicator `PAGE 02 / 08`.

**`VideoCard.tsx`:**
- Props: `{ video: VideoDTO }` (typed from shared).
- Thumbnail with 2px black border. Duration badge bottom-right: `[ 12:34 ]` mono.
- Title below: 2 lines max, mono, ALL-CAPS optional based on density.
- Meta row: channel name `// USERNAME` link + view count `123K VIEWS -->` + relative date.
- Hover: `glitch` class triggers RGB split on title; card translates `(2px, 2px)`; thumbnail gets a subtle `mix-blend-mode: difference` overlay (gated by motion preference).

**`VideoGrid.tsx`** wraps cards in the asymmetric layout. Empty state: `EmptyState` component reading `// NO SIGNAL // try a different query`.

**SECURITY:**
- Search query passes through `useDebounce` to limit API hits.
- Pagination params clamped server-side already (STEP 10) via `listVideoQuerySchema`.
- Component props typed against shared DTOs — passing wrong shape fails compile.

---

## STEP 26 — Video Detail Page: HLS Player, Meta, Likes, Comments, Recommendations

**Layout (desktop):** two columns — left (player + meta + comments, 70%), right rail (recommendations, 30%). Mobile: stacked.

### `VideoPlayer.tsx`

```tsx
import ReactPlayer from 'react-player';
import { useRef } from 'react';
import { usePreferences } from '../../context/PreferencesContext.js';
import * as videoService from '../../services/video.service.js';
import { useGuestFingerprint } from '../../hooks/useGuestFingerprint.js';

type Props = { videoId: string };

export const VideoPlayer = ({ videoId }: Props) => {
  const { preferences } = usePreferences();
  const fingerprint = useGuestFingerprint();
  const recordedRef = useRef(false);

  const handleReady = () => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    videoService.recordView(videoId, { fingerprint }).catch(() => { /* swallow */ });
  };

  return (
    <div className="border-2 border-ink">
      <ReactPlayer
        url={`${import.meta.env.VITE_API_URL}/api/stream/${videoId}/index.m3u8`}
        controls
        width="100%"
        height="auto"
        playing={false}
        volume={preferences.content.defaultVolume}
        onReady={handleReady}
        config={{ file: { forceHLS: true, hlsOptions: { enableWorker: true } } }}
      />
    </div>
  );
};
```

Wrapped in a 2px black border container. Below: a "scrubbing bar" decorative element showing fake waveform (purely aesthetic SVG).

### `VideoMeta.tsx`

- Props: `{ video: VideoDTO }`.
- Title: oversized mono, ALL-CAPS, with optional glitch on hover.
- Row: `[ READY ]` status badge if author viewing own; views `123 VIEWS -->`; uploaded date `// 12 APR 2026`.
- Channel block: avatar placeholder, `// USERNAME`, `123 SUBSCRIBERS`, `[ SUBSCRIBE ]` button.
- Like/Dislike block: `[ + 42 ]` `[ - 3 ]` buttons. Active state inverts colors.
- Description card: collapsible, default 4 lines, `[ EXPAND ]` toggle.

### Comments section

- Header: `// COMMENTS // 12 -->`.
- `CommentForm.tsx` (top): authed users only. Mono textarea, character counter `42 / 1000`, `[ POST ]` button.
- `CommentList.tsx`: paginated with "LOAD MORE" button.
- Each `CommentItem.tsx`: avatar box, username link, relative date, body, action row `[ REPLY ] [ EDIT ] [ DELETE ]` (conditional on auth + ownership).

### Right rail recommendations

- Header: `// RELATED SIGNALS`.
- 8 small cards (smaller `VideoCard` variant) — fetched from `GET /api/videos/:videoId/recommendations`.
- Section divider: `// MORE FROM // <CHANNEL_NAME>` between same-creator and global.

**SECURITY:**
- View record is sent only after player is ready, with auth token if present + fingerprint if guest.
- Comment edit/delete buttons are gated client-side AND server-side.
- React JSX escape protects comment body from XSS.

---

## STEP 27 — Upload Page: Drag-Drop, Progress Bar, Processing Status Polling

**`UploadPage.tsx` layout:**
- Header: `// UPLOAD // INJECT NEW SIGNAL`.
- **Constraint banner directly under header** (always visible, brutal warning card):
  ```
  // CONSTRAINTS //
  >> MAX SIZE       100 MB
  >> MAX DURATION   2 MIN
  >> KEEP IT TIGHT  // server is on a strict diet
  ```
  Values read from `import.meta.env.VITE_MAX_UPLOAD_SIZE_MB` and `VITE_MAX_VIDEO_DURATION_SECONDS`.
- Two-stage flow:
  1. **DropZone** stage (before file selected).
  2. **Form + Progress + Processing** stage (after file selected).

### `DropZone.tsx`

- Props: `{ onFile: (file: File) => void, maxSizeMb: number, maxDurationSec: number }`.
- Large square area with 4px dashed black border.
- Default text: `>> DROP A VIDEO FILE HERE` + below `// OR [ BROWSE ]` + tertiary line `// MAX 2 MIN // KEEP IT TIGHT`.
- On drag-over: border becomes solid acid; background shifts to acid at 10% opacity.
- On drop / browse: validate MIME (must start with `video/`) and size (≤ `maxSizeMb`).
- **Client-side duration check** (typed):

  ```ts
  const probeFileDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.onerror = () => reject(new Error('Cannot read video metadata'));
      video.src = URL.createObjectURL(file);
    });
  ```

  If duration > maxDurationSec, reject with toast: `// VIDEO TOO LONG // <duration>s exceeds <max>s limit`.
- Show file metadata after acceptance: name, size in MB, type, **duration `MM:SS`**.

### Form fields (after file picked)

- `BrutalInput` title (required, 3–120).
- Textarea description (max 5000, with character counter).
- Tags input: chips-style — type, press Enter, chip appears. Max 8.
- Visibility toggle: `[ PUBLIC ] [ UNLISTED ]` — typed `VideoVisibility`.
- `[ INITIATE TRANSCODE ]` submit button.

The submit handler validates the entire form against `createVideoSchema` (shared) before calling the service.

### Upload submission

- Build `FormData` with `video, title, description, tags, visibility`.
- `videoService.uploadVideo(formData, { onUploadProgress })` — typed:

  ```ts
  // services/video.service.ts
  export const uploadVideo = async (
    data: FormData,
    config: { onUploadProgress?: (e: { loaded: number; total?: number }) => void },
  ): Promise<VideoStatusDTO> => {
    const { data: res } = await api.post<ApiResponse<VideoStatusDTO>>('/api/videos/upload', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: config.onUploadProgress,
    });
    if (!res.success) throw new Error(res.message);
    return res.data;
  };
  ```

- `useUploadProgress()` hook tracks percent.
- Show `ProgressBar`: brutalist horizontal bar (2px border, fill animated step by step, label `42% -->` with monospace tabular nums).
- On 201 response: receive `{ videoId, status: 'pending' }`.

### Processing status polling

- Switch UI to `ProcessingStatus.tsx` component.
- Poll `GET /api/videos/:videoId/status` every 3 seconds (max 5 minutes).
- Display states with brutal banners:
  - `[ PENDING ]` — `// queued`
  - `[ PROCESSING ]` — `// FFMPEG IS CRUNCHING THE SIGNAL` + `AsciiSpinner`
  - `[ READY ]` — `// LIVE -->` + `[ WATCH NOW ]` button → `/v/:videoId`
  - `[ FAILED ]` — `// SIGNAL LOST` + error message + `[ TRY AGAIN ]` button.
- Below polling banner: a faux "log stream" decorative panel printing pseudo-log lines.

**SECURITY:**
- Client-side validates MIME + size + duration before upload — defense in depth.
- Tags lowercased + trimmed by Zod transform before sending.
- Upload button disabled while uploading or processing.

---

## STEP 28 — Studio Dashboard: My Videos, Status Tabs, Edit/Delete

**`StudioPage.tsx` layout:**
- Header: `// STUDIO // YOUR SIGNAL ARCHIVE`.
- KPI strip (4 cards): `TOTAL VIDEOS`, `TOTAL VIEWS`, `TOTAL LIKES`, `SUBSCRIBERS`.
- Status tabs (typed against `VideoStatus`): `[ ALL ] [ READY ] [ PROCESSING ] [ PENDING ] [ FAILED ]` — counts in brackets.
- Table of videos (grid on mobile):
  - Columns: thumbnail, title (with status badge), views, likes, comments, uploaded date, actions.
  - Actions: `[ VIEW ]` (only if ready), `[ EDIT ]`, `[ DELETE ]`.
- `[ EDIT ]` opens a `BrutalModal` with editable form (title, description, tags, visibility) validated by `updateVideoSchema`.
- `[ DELETE ]` opens a confirm modal: `// PERMANENT DELETION` + checkbox.

**Failed videos** show inline error in title cell: `// reason: <processingError>` (typed `string | null` — show only if non-null).

**SECURITY:**
- All actions hit ownership-checked endpoints.
- Confirm modal requires explicit confirmation step.

---

## STEP 29 — Channel Public Page: Creator Profile + Their Videos

**`ChannelPage.tsx` (`/c/:username`):**
- Banner strip (full-width, 240px tall).
- Below banner card: avatar box (square, 96px, 2px border), `// DISPLAY_NAME`, `@username`, `123 SUBSCRIBERS // 42 VIDEOS // 1.2M VIEWS`, bio, `[ SUBSCRIBE ]` button.
- Tabs: `[ VIDEOS ] [ ABOUT ]`.
- Videos tab: same `VideoGrid` as home but filtered by channel (`getByChannel`).
- About tab: bio long form + member-since date.

Page consumes `PublicUserDTO` — no risk of leaking `email` or `preferences` (TS literally won't show those properties).

**SECURITY:**
- Channel page is public; only safe fields returned (STEP 15).
- Subscribe action is auth-gated.

---

## STEP 30 — User Profile, Watch History & Subscription Feed

**`ProfilePage.tsx` (`/me`):**
- Personal dashboard, mirrors channel page but always shows full data + edit shortcuts.
- Quick links: `[ MY CHANNEL ]` (→ `/c/:username`), `[ STUDIO ]` (creator only), `[ SETTINGS ]`, `[ HISTORY ]`, `[ SUBSCRIPTIONS ]`.
- "Become a creator" CTA card if role is `viewer`: `// UPGRADE // GET UPLOAD ACCESS` `[ BECOME CREATOR ]`.

**`HistoryPage.tsx` (`/me/history`):**
- Header: `// WATCH HISTORY`.
- Reuses `VideoGrid` with simpler vertical list layout.
- Empty state: `// VOID // no videos watched yet`.

**`SubscriptionsPage.tsx` (`/me/subscriptions`):**
- Two sections:
  1. `// CHANNELS YOU FOLLOW` — horizontal scrollable strip of channel cards.
  2. `// LATEST FROM YOUR CHANNELS` — `VideoGrid` from `subscriptionFeed`.
- Empty state: `// NO TRANSMISSIONS`.

---

## STEP 31 — Settings: Profile, Account, Appearance, Privacy, Notifications

All settings pages share `SettingsLayout`. Auto-save (no submit button) for toggles and selects; explicit save button for text fields. Each save call sends a payload validated against `updatePreferencesSchema` (or `updateProfileSchema`).

**`ProfileSettingsPage.tsx`:**
- Display name input.
- Bio textarea (with character counter).
- Banner URL input (with preview if valid URL).
- `[ SAVE PROFILE ]` button.

**`AccountSettingsPage.tsx`:**
- Read-only: username, email (with `// LOCKED` badge).
- Change password form (current, new, confirm) using `changePasswordSchema`.
- "Become a creator" CTA (if applicable).
- Delete account section (danger zone) — orange card, requires password confirmation in modal.

**`AppearanceSettingsPage.tsx`** (works for guests too — uses local prefs):
- Theme: `[ LIGHT ] [ DARK ] [ SYSTEM ]` segmented (typed `'light' | 'dark' | 'system'`).
- Accent color: 4 swatches (typed `'acid' | 'magenta' | 'electric' | 'orange'`).
- Font size: `[ SM ] [ MD ] [ LG ]` segmented.
- Density: `[ COMPACT ] [ COMFORTABLE ]` segmented.
- Animations: `[ FULL ] [ REDUCED ] [ OFF ]` segmented.
- Scanlines: `BrutalToggle`.

Each setter is `updatePreference('theme', 'dark')` — TS verifies the value matches the key's type.

**`PrivacySettingsPage.tsx`:**
- `BrutalToggle` per privacy field: showEmail, showHistory, showSubscriptions.
- Each with explanatory help text below.

**`NotificationSettingsPage.tsx`:**
- `BrutalToggle` per notification: newSubscriber, newComment.
- Note: "Notifications are visual indicators only in MVP — no email/push yet".

**SECURITY:**
- Each settings change calls `updatePreferences` which validates server-side.
- Account delete + password change require current password.
- Email cannot be changed via API in MVP (locked).

---

## STEP 32 — Admin Panel: Dashboard, Users, Videos, Comments

All admin pages live under `AdminLayout`. The visual language amplifies brutalism — black sidebar, acid accents, large data tables with monospace columns.

**`AdminDashboardPage.tsx`:**
- KPI grid: `USERS`, `VIDEOS`, `VIEWS`, `COMMENTS`.
- Status breakdown bar chart (text-based / ASCII bars): `READY ████████ 124 // PROCESSING ██ 4 // FAILED █ 1`.
- Recent activity panel: 7-day new users.
- Top 5 videos by views.
- **`DiskUsageWidget.tsx`** (new brutal card — fetches `GET /api/admin/maintenance/disk` every 60s, typed `DiskUsageReport`):
  ```
  // STORAGE //
  USED  1.2 GB / 3 GB  -->  40%
  ████████░░░░░░░░░░░░
  >> 23 VIDEOS  // 0 RAW  // 1 ORPHAN
  [ RUN CLEANUP ]
  ```
  - Bar fill color computed from `report.alertLevel` — TS exhaustive switch ensures all three levels handled.
  - `[ RUN CLEANUP ]` opens confirm modal with "dry run" toggle. Result rendered from `CleanupReport`.
  - Critical-level (>80%) shows persistent banner.

**`AdminUsersPage.tsx`:**
- Search input + role filter (`UserRole` union).
- Table: avatar, username, email, role, status (banned?), joined, actions.
- Actions: change role dropdown, `[ BAN ]` / `[ UNBAN ]`, `[ DELETE ]`.

**`AdminVideosPage.tsx`:**
- Search title + status filter (`VideoStatus`) + flagged filter.
- Table: thumbnail, title, author, status, views, flagged, uploaded, actions.

**`AdminCommentsPage.tsx`:**
- Search body + filter by video.
- Table: body excerpt, author, video link, posted, actions.

**SECURITY:**
- All actions confirm before destructive ops.
- Self-protection feedback: trying to change own role / ban self / delete self surfaces a toast `// CANNOT MODIFY SELF`.
- Last-admin protection.

---

## STEP 33 — UX Enhancements: ASCII Loaders, Empty States, Toasts, Glitch Hover

**`AsciiSpinner.tsx`:**

```tsx
import { useEffect, useState } from 'react';

const FRAMES = ['[|]', '[/]', '[-]', '[\\]'] as const;

export const AsciiSpinner = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % FRAMES.length), 100);
    return () => window.clearInterval(id);
  }, []);
  return <span className="font-mono text-acid">{FRAMES[i]}</span>;
};
```

`as const` makes `FRAMES[i]` typed as a literal — `noUncheckedIndexedAccess` requires `FRAMES[i]!` or a guard, but here `i % FRAMES.length` proves the access is safe. Use `as const satisfies readonly string[]` if the linter complains.

**`ScanlineOverlay.tsx`:** controlled by preferences; renders fixed div with the CSS pattern from STEP 20.

**`EmptyState.tsx`:** props `{ icon?: ReactNode, title: string, description: string, action?: ReactNode }`. Renders centered brutal card with `// EMPTY //` decoration.

**`ErrorBlock.tsx`:** props `{ message: string, requestId?: string, onRetry?: () => void }`. Orange border, `// ERROR //` header. If `requestId` present, renders `// REF: <id>` underneath in small mono — copy-paste for `fly logs`.

**Toast configuration** (in `App.tsx` root): default 3s, position top-right, custom class with brutal styling, max 3 stacked.

**Page transitions:** opacity flick (`transition-opacity duration-100`) on route change; respects motion preference.

**Skeletons:** brutalist skeletons — alternating black/cream blocks, no shimmer; use a stepped pulse instead.

**Responsive breakpoints:**
- Mobile (`< 640px`): single-column layouts, hamburger nav, stacked grids.
- Tablet (`640–1024px`): two-column where appropriate.
- Desktop (`≥ 1024px`): asymmetric grids and right rails.

---

## STEP 34 — 404 Glitch Page & Route Guard Refinements

**`NotFoundPage.tsx`:**
- Full-bleed background with animated noise SVG (gated by motion).
- Massive `404` text in display font, ALL-CAPS, with constant RGB-split glitch animation.
- Below: `// SIGNAL LOST` + `// THE FRAME YOU SEEKING DOES NOT EXIST` + `[ RETURN HOME ]` brutal button.
- Optional decorative log strip cycling fake error lines.

**Guard refinements:**
- All guards render `AsciiSpinner` while `loading`.
- `CreatorRoute` shows `// CREATOR ACCESS REQUIRED` block with `[ BECOME A CREATOR ]` CTA when blocked.
- `AdminRoute` shows a dedicated 403 panel: `// 403 // ADMIN AUTHORITY REQUIRED`.

---

## STEP 35 — README & Documentation

**Sections:**

1. **Title + tagline + screenshot placeholder** (3–4 screenshots: home, video detail, upload, admin).
2. **What is FRAGMENT?** — 3-paragraph intro explaining brutalist aesthetic + technical concept.
3. **Tech stack badges** — TypeScript 5, React 19, Express 5, MongoDB, FFmpeg, TailwindCSS v4, Zod.
4. **Features list** — bulleted, organized by viewer / creator / admin.
5. **What is HLS?** — short explanation: "HLS (HTTP Live Streaming) splits video into small `.ts` segments and a `.m3u8` playlist. Browsers (via HLS.js) fetch segments sequentially, enabling instant playback, range requests, and CDN edge caching. FRAGMENT transcodes uploads to single-bitrate HLS for MVP simplicity."
6. **Why TypeScript?** (NEW) — 1-paragraph: shared types between client and server via `@fragment/shared` workspace; runtime validation via Zod schemas that double as compile-time types; Mongoose `InferSchemaType` removes the need for hand-written model interfaces.
7. **System requirements:**
   - Node 20+
   - MongoDB 6+ (local or Atlas)
   - FFmpeg 4.4+ installed and on PATH (or Docker, which bundles it)
   - At least 2GB free disk for local `uploads/` (3GB persistent volume in production on Fly.io)
   - For deployment: `flyctl` CLI installed
8. **FFmpeg installation:** Windows / macOS / Linux / WSL instructions + verification command.
9. **Roles & Permissions table** (from STEP 6).
10. **API Endpoints table** — every route grouped by resource.
11. **Folder structure** — collapsed tree, highlighting the workspace layout.
12. **Security section** — bullet summary of every layer.
13. **Getting started:**
    - Clone
    - `npm install` at the root (workspaces install all three)
    - `npm run build:shared` (produce `shared/dist/` for type resolution)
    - `cd server && cp .env.example .env` (fill MONGO_URI, JWT_SECRET ≥32 chars)
    - `npm run seed:admin` (with `SEED_ADMIN_*` env vars)
    - `npm run dev:server` (from root) or `npm run dev` from `server/`
    - `cd ../client && cp .env.example .env`
    - `npm run dev:client` (from root)
14. **Type checking & linting:** `npm run typecheck` runs `tsc --build` across all workspaces.
15. **Deployment:** summary pointing to STEP 38–42 details.
16. **Production scaling note:** "FFmpeg processing currently runs in-process via `processVideo` fire-and-forget. For concurrent uploads beyond CPU capacity, replace with **BullMQ + Redis** queue and a dedicated worker process. The current architecture stores HLS output on a **Fly.io 3 GB persistent volume** served directly via `express.static`. For higher traffic, migrate to object storage + CDN — see [`docs/MIGRATION-TO-B2.md`](./docs/MIGRATION-TO-B2.md)."
17. **MVP limitations:** single bitrate (no adaptive), no live streaming, no email notifications, no avatar upload (URL-only), no private videos (only public/unlisted), 3 GB total video storage on the free Fly.io tier.
18. **Portfolio deployment notes.**
19. **License + author + acknowledgments.**

---

## STEP 36 — Code Cleanup & Pre-Deploy Review

Pre-deployment checklist — execute and tick each:

- [x] Run `npm run typecheck` from root — zero errors across `shared`, `server`, `client`.
- [x] Run `npm run lint --workspace=fragment-client` — zero warnings.
- [x] Run `npm run build` from root — shared builds, server emits `dist/`, client builds to `client/dist/`.
- [x] Remove every `console.log` from production code paths (keep `console.error` for the error handler and the processing pipeline).
- [x] Remove unused imports across all files.
- [x] Confirm `.env.example` (server + client) lists every variable and contains only placeholders.
- [x] Confirm `.gitignore` excludes `.env`, `node_modules/`, `uploads/raw/*`, `uploads/processed/*`, `dist/`, `build/`, `*.tsbuildinfo`, logs.
- [x] Search the repo for any hardcoded localhost URL — must come from `import.meta.env.VITE_API_URL` or `env.CLIENT_ORIGIN`.
- [x] Search for any `dangerouslySetInnerHTML` — must be zero.
- [x] Search for any `as any` or `// @ts-ignore` — must be zero (or fully justified).
- [x] Confirm all forms have `autoComplete` attributes set appropriately.
- [x] Confirm all `<img>` tags have `alt` attributes.
- [ ] Confirm color contrast on dark and light themes hits WCAG AA via axe DevTools.
- [x] Confirm reduced-motion preference truly disables all animations.
- [x] Run `npm audit` on all workspaces; resolve high/critical.
- [x] Confirm `package.json` `engines.node` is set (`>=20`) at the root.
- [ ] Smoke test: register → login → upload short video → wait for ready → watch → like → comment → subscribe → admin demote → admin ban (test account) → logout.

---

## STEP 37 — Demo Seed Data: 14+ Pre-Populated Videos for Live Portfolio

A portfolio link that opens to an empty grid is a wasted impression. This step creates a **`server/src/seed/seedDemo.ts`** script that, when run once after first deployment, populates the live database with **3 demo creators**, **14 short videos**, **35+ comments**, and **8+ subscriptions**.

### A) Where to Get the Demo Videos

You need **14 short MP4 files**, each **≤60 seconds**, **≤10 MB**, **720p or lower**.

| Source | URL | Why it works |
|---|---|---|
| **Pexels Videos** | `https://www.pexels.com/videos/` | Free for commercial use, no attribution required. |
| **Pixabay Video** | `https://pixabay.com/videos/` | Same license model as Pexels. Lots of abstract content. |
| **Coverr** | `https://coverr.co/` | Curated short stock videos, mostly under 30 seconds. CC0 license. |
| **Mixkit** | `https://mixkit.co/free-stock-video/` | Free for personal + commercial use. |
| **Your own footage** | Phone recordings | Fully owned, no licensing concerns. |

**Recommended thematic mix for FRAGMENT:**

| Theme | Suggested count | Search terms |
|---|---|---|
| Abstract / motion graphics | 4 | "glitch", "noise", "geometric loop" |
| City / brutalist architecture | 3 | "concrete building", "brutalism architecture" |
| Tech / code / screens | 3 | "code editor", "terminal", "cyberpunk" |
| Nature / minimal | 2 | "fog forest", "wave slow" |
| Performance / dance | 2 | "dance studio", "performer dark" |

**Compression workflow:**

```bash
ffmpeg -i input.mp4 -vf "scale=-2:720" -c:v libx264 -preset slow -crf 28 -c:a aac -b:a 96k -t 45 output.mp4
```

### B) Folder Structure

```
server/src/seed/
├── seedAdmin.ts
├── seedDemo.ts
└── demo-assets/
    ├── videos/
    │   ├── 01-glitch-loop.mp4
    │   ├── 02-concrete.mp4
    │   ├── ...
    │   └── 14-performer-spotlight.mp4
    └── metadata.json
```

**`metadata.json` structure** with a typed loader.

```json
{
  "creators": [
    { "username": "voidsignal", "displayName": "VOID SIGNAL", "email": "voidsignal@fragment.demo", "bio": "transmissions from the dead frame buffer.", "bannerUrl": null },
    { "username": "concrete_eye", "displayName": "CONCRETE EYE", "email": "concrete@fragment.demo", "bio": "brutalist architecture documentation.", "bannerUrl": null },
    { "username": "glitchtape", "displayName": "GLITCH TAPE", "email": "glitchtape@fragment.demo", "bio": "found footage // analog decay // VHS rituals.", "bannerUrl": null }
  ],
  "videos": [
    { "file": "01-glitch-loop.mp4", "creator": "glitchtape", "title": "DEAD FRAME // 001", "description": "First transmission from the broken loop.", "tags": ["glitch", "loop", "analog", "noise"] },
    { "file": "02-concrete.mp4", "creator": "concrete_eye", "title": "CONCRETE STUDY # 14", "description": "Documentation of post-war housing block.", "tags": ["brutalism", "architecture", "concrete"] }
  ],
  "comments": [
    { "video": "01-glitch-loop.mp4", "author": "concrete_eye", "body": "the texture on this is unreal" }
  ],
  "subscriptions": [
    { "subscriber": "voidsignal", "channel": "glitchtape" }
  ]
}
```

A Zod schema validates the JSON at seed time:

```ts
import { z } from 'zod';

const seedSchema = z.object({
  creators: z.array(z.object({
    username: z.string(),
    displayName: z.string(),
    email: z.string().email(),
    bio: z.string(),
    bannerUrl: z.string().url().nullable(),
  })),
  videos: z.array(z.object({
    file: z.string(),
    creator: z.string(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
  })),
  comments: z.array(z.object({ video: z.string(), author: z.string(), body: z.string() })),
  subscriptions: z.array(z.object({ subscriber: z.string(), channel: z.string() })),
});
type SeedData = z.infer<typeof seedSchema>;
```

Bad metadata.json → seed crashes loudly with field-level errors, never half-populates the DB.

### C) `seedDemo.ts` Logic

The script must be **idempotent**:

1. Connect to MongoDB.
2. Load + Zod-parse `metadata.json` (fails fast on bad data).
3. **For each creator:** if user with this username already exists → skip. Otherwise create with `role: 'creator'`, password = `process.env.DEMO_PASSWORD ?? 'fragment-demo-2026'`.
4. **For each video:**
   - If a video with `originalFilename === entry.file` AND `author === <creator id>` already exists → skip.
   - Otherwise: copy the source MP4 from `seed/demo-assets/videos/<file>` into `UPLOAD_DIR_RAW` with a server-generated nanoid name. Create the Video doc. `await processVideo(videoDoc, copiedRawPath)` (sequential, not fire-and-forget — easier to debug).
   - Log progress: `[seed] processed 03/14 — DEAD FRAME // 001`.
5. **For each comment:** find video + author → upsert.
6. **For each subscription:** `Subscription.findOneAndUpdate({ subscriber, channel }, { ... }, { upsert: true })`.
7. Print summary.

### D) Add npm Script

In root `package.json`:

```json
{
  "scripts": {
    "seed:admin": "npm run seed:admin --workspace=fragment-server",
    "seed:demo": "npm run seed:demo --workspace=fragment-server"
  }
}
```

Server scripts already use `tsx` to run `.ts` files directly.

### E) `.gitignore` + `.dockerignore` Update

**`.gitignore`** add:

```
server/src/seed/demo-assets/videos/
!server/src/seed/demo-assets/videos/.gitkeep
```

**`.dockerignore`** — REMOVE `seed/demo-assets` from the exclusion list if you bake demo videos into the image (Path 1 below).

**Repo note:** Document the manual-step requirement in `README.md`.

### F) How to Get Videos Into the Live Deployment

Since you won't run the project locally, you need to get videos onto the Fly.io VM.

**Path 1 — Bake videos into the Docker image (simplest):**

1. On your local machine, download 14 videos into `server/src/seed/demo-assets/videos/`.
2. Confirm `.dockerignore` does NOT exclude `seed/demo-assets/`.
3. `fly deploy`.
4. SSH into the running VM: `fly ssh console`.
5. Run the seed: `npm run seed:demo` (the script uses `tsx` which is in devDependencies — see Dockerfile note in STEP 40 below). For production-only image without tsx, run the compiled JS: `node dist/seed/seedDemo.js`.
6. Watch logs: each video takes ~10-30 seconds to transcode on the small VM.

> **Note on tsx in production:** since the Dockerfile uses `npm ci --omit=dev`, `tsx` won't be available at runtime. The seed scripts ship as compiled `dist/seed/seedAdmin.js` and `dist/seed/seedDemo.js`. Update the npm script for production: `"seed:demo": "node dist/seed/seedDemo.js"` and use that variant inside the container. Keep the `tsx` variant as `seed:demo:dev` for local development.

**Path 2 — Upload videos via SCP after deploy (keeps image small):**

1. Don't bake videos into the image.
2. After `fly deploy`, copy videos directly to the persistent volume via `fly ssh sftp shell`.
3. Modify `seedDemo.ts` to read from `/data/seed-videos/` in production (use an env var like `DEMO_VIDEOS_DIR`).

**Recommendation:** Use **Path 1**.

### G) Verification After Seed Run

```bash
fly ssh console -C "node -e \"const m=require('mongoose'); m.connect(process.env.MONGO_URI).then(async()=>{const V=m.model('Video'); const c=await V.countDocuments({status:'ready'}); console.log('ready videos:',c); process.exit(0);})\""
```

Expected output: `ready videos: 14`.

### H) Re-Seeding Strategy

If you want to wipe and re-seed:

```bash
fly ssh console
node -e "const m=require('mongoose'); m.connect(process.env.MONGO_URI).then(async()=>{
  await m.connection.db.dropDatabase();
  console.log('database dropped'); process.exit(0);
})"
rm -rf /data/uploads/processed/*
exit
fly ssh console -C "node dist/seed/seedAdmin.js && node dist/seed/seedDemo.js"
```

> **Caution:** This wipes ALL data.

**SECURITY:**
- Demo creator passwords are documented in the script (default: `fragment-demo-2026`).
- Demo emails use the `@fragment.demo` domain.
- Idempotent design.
- The seed runs through the **real** `processVideo` pipeline.
- `seedSchema` Zod parse means malformed `metadata.json` aborts cleanly.

---

## STEP 38 — Billing Safety Checklist & Fly.io Account Prep (Zero-Install / GitHub Actions Mode)

> **Deployment model:** This guide uses the **CLI-free** path — `flyctl` is **never installed locally**. Every Fly.io operation runs either in the **Dashboard** (browser) or inside **GitHub Actions** (cloud). The only thing your machine needs is `git`.

### Why Fly.io (Not Render)

| Feature | Fly.io Free Tier |
|---|---|
| VMs | Up to 3 shared-cpu-1x machines, 256 MB RAM each (scalable to 1 GB if needed) |
| Persistent volume | **3 GB free** per app |
| Outbound bandwidth | 160 GB/month (NA + EU regions) |
| Always-on | **No spin-down** |
| FFmpeg support | ✅ Native via Dockerfile |
| Custom domains + HTTPS | ✅ Free, automatic |

> **Disk usage discipline:** Set `MAX_UPLOAD_SIZE_MB=100` and target 720p / ≤60s demo clips.

---

### ⚠️ Billing Safety Checklist (DO THIS FIRST)

#### A) Use a Virtual / Limited Card

| Option | Why it works |
|---|---|
| **Wise** virtual USD card | You control the balance. |
| **Papara** virtual card | Turkish provider. |
| **Revolut / N26** | Virtual + freezable cards. |
| **Bank limit reduction** | Set "online shopping limit" to ₺200/month. |
| **Prepaid debit** | Buy a prepaid Visa with $5–10 balance. |

#### B) Sign Up

1. Go to `https://fly.io/app/sign-up`.
2. Sign up with email + GitHub OAuth (recommended — same identity as your repo).
3. Add the virtual / limited card from step A when prompted.

#### C) Set Spending Limit to $0 (THE CRITICAL STEP)

1. Go to `https://fly.io/dashboard`.
2. Click your org name → **Billing**.
3. Find **"Spending Limit"** section.
4. Set the limit to **`$0`** (or `$5` for safety).
5. Save.

#### D) Enable Billing Alerts

Same Billing page → **Alerts** section: threshold `$1`, notification: your email.

#### E) Verify Free-Tier Compliance (via Dashboard)

| Check | Where |
|---|---|
| Org plan = Hobby (free) | `Dashboard → Org → Billing` |
| Spending limit = `$0` | `Dashboard → Org → Billing → Spending Limit` |
| No active apps yet | `Dashboard → Apps` (empty list before STEP 41) |

After STEP 41 deploy, the same dashboard will show:
- App `fragment-api` with **1 machine running**.
- 1 volume `fragment_data` of **3 GB**.
- Net monthly bill: **$0**.

#### F) Monthly Discipline

Once a month, open `https://fly.io/dashboard` and check:
- **Org → Billing → Current usage** stays at `$0`.
- **App → Metrics** for unusual CPU / bandwidth spikes.
- **App → Volumes** disk usage (should stay below 2.8 GB — the `DISK_QUOTA_MB` cap from STEP 41).

If anything above `$5` accumulates, jump to **G) Emergency Stop**.

#### G) Emergency Stop (via Dashboard)

1. `Dashboard → Apps → fragment-api → Settings → Delete app` (instantly stops all billing).
2. Or, less destructive: `Dashboard → Apps → fragment-api → Machines → Stop` on each machine.

---

### GitHub Actions Setup (Replaces `flyctl` Installation)

The `flyctl` CLI runs **inside GitHub Actions** — your laptop stays clean. To enable that, generate one Fly.io API token and store it as a GitHub repository secret. The actual workflow file (`.github/workflows/fly-deploy.yml`) is created in STEP 41.

#### A) Generate the Fly.io API Token

1. `Dashboard → User Settings → Access Tokens`.
2. **Create access token**:
   - Name: `github-actions-fragment`
   - Expiry: `Never` (or 1 year, your call).
3. **Copy the token immediately — Fly shows it only once.** It starts with `FlyV1 fm2_…`.

#### B) Add the Token to GitHub Secrets

1. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `FLY_API_TOKEN`.
3. Value: paste the token from step A.
4. **Add secret**.

> **SECURITY:** Treat this token like a password. It can deploy, destroy, and read secrets on every Fly.io app in your org. If leaked, revoke it from `Dashboard → User Settings → Access Tokens → Revoke`.

#### C) Verify the Token (Optional, via Dashboard)

`Dashboard → User Settings → Access Tokens` → confirm `github-actions-fragment` is listed with status **Active**.

> The token is **not testable from your laptop** because we are not installing `flyctl`. The first real test happens when the GitHub Actions workflow runs in STEP 41.

---

### Deployment Mode Summary

| Operation | How (Zero-Install Mode) |
|---|---|
| Sign up / billing | Browser → `fly.io/dashboard` |
| Generate API token | Dashboard → User Settings → Access Tokens |
| Create app | First `git push` triggers GitHub Action which runs `flyctl deploy` |
| Create volume | Dashboard → App → Volumes → **+ New volume** (STEP 41) |
| Set secrets | Dashboard → App → Secrets → **+ New secret** (STEP 41) |
| Deploy new code | `git push origin main` (GitHub Actions auto-deploys) |
| View logs | Dashboard → App → **Live Logs** tab |
| SSH into machine | Dashboard → App → **Console** tab (web terminal) |
| Run admin seed | One-off `workflow_dispatch` GitHub Action (STEP 41) |
| Restart app | Dashboard → App → Machines → **Restart** |

**Exit criteria for STEP 38:**
- Spending limit set to `$0` in Fly.io billing dashboard.
- Billing alert at `$1` configured.
- Virtual / limited card on file.
- Fly.io API token generated and stored as GitHub repository secret named `FLY_API_TOKEN`.
- **No** `flyctl` binary installed on your local machine.

---

## STEP 39 — MongoDB Atlas Setup

### A) Create the Cluster

1. Sign up at `https://cloud.mongodb.com`.
2. **Build a Database** → **M0 (Free)** → choose region close to your Fly.io region → **Create**.
3. Cluster name: `fragment-cluster`.

### B) Database User

1. **Database Access** → **Add New Database User**.
2. Auth method: **Password**.
3. Username: `fragment_app`.
4. Password: **Autogenerate Secure Password**, save in password manager.
5. Privileges: **Read and write to any database**.
6. Save.

### C) Network Access

1. **Network Access** → **Add IP Address**.
2. Add `0.0.0.0/0` (Fly.io free-tier machines lack stable egress IPs).

### D) Connection String

1. **Database** → **Connect** → **Drivers** → **Node.js**, latest.
2. Copy SRV string, replace `<password>`, insert `fragment` database name:
   ```
   mongodb+srv://fragment_app:Y0urR3alP4ss@fragment-cluster.xxxxx.mongodb.net/fragment?retryWrites=true&w=majority
   ```

### E) Smoke Test (Optional)

```bash
cd server
npx tsx -e "import('mongoose').then(m => m.default.connect('<your MONGO_URI>').then(() => { console.log('OK'); process.exit(0); }))"
```

**Exit criteria for STEP 39:**
- Free M0 cluster running.
- Database user `fragment_app` with strong password.
- IP allowlist includes `0.0.0.0/0`.
- Final SRV connection string saved.

**SECURITY:**
- Never commit the connection string.
- Rotate the database password every 6 months.

---

## STEP 40 — Backend Containerization (Dockerfile with TS Build Stage)

Fly.io deploys the backend as a Docker container. The image must include the FFmpeg binary, the Node.js runtime, the **compiled JS** from `tsc`, and the production node_modules. We use a **multi-stage build**: a `builder` stage installs ALL deps and runs `tsc`, then the runtime stage copies only `dist/` and production deps.

### A) `server/Dockerfile`

```dockerfile
# ---- Builder stage: compile TypeScript ----
FROM node:20-bookworm-slim AS builder
WORKDIR /build

# Copy workspace package manifests for npm workspaces
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

# Install all deps (including dev) for the build
RUN npm ci

# Copy source
COPY shared ./shared
COPY server ./server

# Build shared first (composite project), then server
RUN npm run build:shared && npm run build --workspace=fragment-server

# Prune dev dependencies for the runtime image
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy built artifacts + production node_modules from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/shared/dist ./shared/dist
COPY --from=builder /build/shared/package.json ./shared/
COPY --from=builder /build/server/dist ./server/dist
COPY --from=builder /build/server/package.json ./server/

# Optional: copy demo assets if Path 1 from STEP 37
COPY --from=builder /build/server/src/seed/demo-assets ./server/src/seed/demo-assets

RUN mkdir -p /data/uploads/raw /data/uploads/processed

ENV NODE_ENV=production
ENV UPLOAD_DIR_RAW=/data/uploads/raw
ENV UPLOAD_DIR_PROCESSED=/data/uploads/processed

WORKDIR /app/server
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Key points:
- **Multi-stage** keeps the runtime image lean — no TypeScript, no `tsx`, no `@types/*`. Final image ~330–360 MB.
- **`builder`** runs `npm ci` (full install) → `npm run build:shared && npm run build --workspace=fragment-server` → `npm prune --omit=dev` to strip devDeps from `node_modules`.
- **Runtime** copies the pruned `node_modules` and the built `dist/` folders.
- `node:20-bookworm-slim` → Debian-based, supports `apt install ffmpeg` cleanly.
- `EXPOSE 3000` → ensure `index.ts` reads `process.env.PORT` (env var set by Fly.io).
- `CMD ["node", "dist/index.js"]` — pure Node, no TS tooling.

### B) `server/.dockerignore`

```
node_modules
dist
.env
.env.local
uploads
.git
.gitignore
README.md
*.log
*.tsbuildinfo
.DS_Store
src/seed/demo-assets/videos
```

> **Demo seed exception:** if you chose Path 1 in STEP 37 (bake demo videos into the image), REMOVE `src/seed/demo-assets/videos` from the exclusion list.

### C) Local Image Sanity Check (Optional)

```bash
docker build -t fragment-api:test -f server/Dockerfile .
docker run --rm fragment-api:test ffmpeg -version
docker run --rm fragment-api:test node -e "console.log(require('./shared/dist/types/api.js'))"
```

The third command verifies the shared workspace was bundled correctly into the image.

**Exit criteria for STEP 40:**
- `server/Dockerfile` exists and follows the multi-stage spec.
- `server/.dockerignore` excludes `node_modules`, `dist`, `.env*`, `uploads`, `.git`.
- (If Docker available locally) image builds without errors and FFmpeg works inside the container.

**SECURITY:**
- `.env` and `.env.local` are explicitly excluded.
- `uploads/` is excluded.
- `dist/` is excluded — production artifacts are built fresh inside the image, never trusted from the host.
- Production runs `NODE_ENV=production` → triggers the JWT_SECRET length check.
- Image base receives security updates from Debian — rebuild monthly.
- The runtime image has NO TypeScript compiler and NO devDependencies — minimal attack surface.

---

## STEP 41 — Fly.io Deploy via GitHub Actions: App, Volume, Secrets, Workflow & Admin Seed

> **Mode:** Zero-install. Every Fly.io operation runs either in the **Dashboard** (browser) or inside a **GitHub Actions** workflow. `flyctl` is **never** installed locally.

> **Order matters:** App → Volume → Secrets → Workflow file → First push. The first deploy will fail if the volume or secrets are missing because `fly.toml` references them.

---

### A) Create the App in the Fly.io Dashboard

`flyctl launch` is replaced by manual app creation in the Dashboard.

1. Open `https://fly.io/dashboard` → **Launch a New App** → **Launch from scratch** (skip templates).
2. **App name:** `fragment-api` if available — otherwise `fragment-api-<yourhandle>` (must be globally unique across Fly.io). **Remember this name** — you'll paste it into `fly.toml` and the workflow file.
3. **Organization:** `personal`.
4. **Region:** `fra` (Frankfurt) for EU, `iad` (Ashburn) for NA. Pick the one closest to your MongoDB Atlas region (STEP 39).
5. Click **Create app** and stop there — do NOT deploy from the Dashboard. The first deploy will come from GitHub Actions in step F.

> **Why "from scratch"?** Templates (Postgres, Redis, etc.) provision paid resources. We want an **empty app shell** so the GitHub Actions deploy is the source of truth.

---

### B) Create the Persistent Volume in the Dashboard

`flyctl volumes create` is replaced by Dashboard creation.

1. Dashboard → `fragment-api` → **Volumes** → **+ New volume**.
2. **Name:** `fragment_data` (must match the `[[mounts]] source` value in `fly.toml`).
3. **Region:** same as the app (`fra` or `iad`).
4. **Size:** `3` GB (free tier limit per app).
5. **Snapshots:** leave the default (daily, 5-day retention) — free.
6. **Create volume**.

Verify in `Dashboard → fragment-api → Volumes`: one row, status **Active**, size **3 GB**.

---

### C) Set Production Secrets in the Dashboard

`flyctl secrets set` is replaced by Dashboard secret creation. Each entry is encrypted at rest and injected as an environment variable into every machine on next deploy.

1. Dashboard → `fragment-api` → **Secrets** → **+ New secret**.
2. Add **each row** below as a separate secret (Name + Value):

| Name | Value |
|---|---|
| `MONGO_URI` | Atlas SRV string from STEP 39 (the full `mongodb+srv://…/fragment?...` URL). |
| `JWT_SECRET` | 64-char hex. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (run locally, paste output). |
| `JWT_EXPIRES_IN` | `7d` |
| `BCRYPT_SALT_ROUNDS` | `12` |
| `CLIENT_ORIGIN` | Netlify URL from STEP 42, e.g. `https://fragment-serkanbyx.netlify.app`. (Set a placeholder now, update after STEP 42.) |
| `MAX_UPLOAD_SIZE_MB` | `100` |
| `HLS_SEGMENT_DURATION` | `10` |
| `THUMBNAIL_TIMESTAMP` | `00:00:02` |
| `MAX_VIDEO_DURATION_SECONDS` | `120` |
| `DISK_QUOTA_MB` | `2800` |
| `SEED_ADMIN_EMAIL` | `admin@fragment.dev` |
| `SEED_ADMIN_USERNAME` | `admin` |
| `SEED_ADMIN_PASSWORD` | Strong random password (≥16 chars, mixed case + digits + symbols). Save in your password manager. |

> **Why Dashboard, not GitHub Secrets?** Production runtime secrets live with the runtime (Fly.io). Only the **deployment token** (`FLY_API_TOKEN` from STEP 38) lives in GitHub Secrets. This separation means a compromised GitHub repo cannot read `MONGO_URI` or `JWT_SECRET`.

Verify in `Dashboard → fragment-api → Secrets`: 13 rows, all with timestamps. Values are hidden — that's expected, Fly never shows them again after creation.

---

### D) Write `fly.toml` at the Repo Root

Without `fly launch` we hand-write the config. Create `fly.toml` at the **repo root** (next to `package.json`):

```toml
# Fly.io app config — consumed by `flyctl deploy` inside the GitHub Action.
# App name MUST match the one created in the Dashboard (step A).
app = "fragment-api"
primary_region = "fra"

[build]
  dockerfile = "server/Dockerfile"

[env]
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[mounts]]
  source = "fragment_data"
  destination = "/data"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

> **If your app name is `fragment-api-serkanbyx`** (because `fragment-api` was taken), update the `app =` line accordingly. The `[[mounts]] source` value MUST match the volume name from step B.

---

### E) Add the Deploy Workflow (`.github/workflows/fly-deploy.yml`)

Create the directory `.github/workflows/` at the repo root and add `fly-deploy.yml`:

```yaml
name: Fly Deploy

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: fly-deploy
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy backend to Fly.io
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Install flyctl
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy app
        run: flyctl deploy --remote-only --dockerfile server/Dockerfile
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

What this does:
- **Trigger:** every push to `main`, plus a manual **Run workflow** button in the GitHub Actions UI.
- **`concurrency`:** queues new deploys if one is already running — never two builds racing for the same machine.
- **`flyctl-actions/setup-flyctl@master`:** installs `flyctl` on the runner only.
- **`--remote-only`:** the Docker image is built **on Fly.io's builder VM**, not the GitHub runner — keeps the runner under the 6 GB / 14 GB limits and avoids pushing the image over the wire.
- **`FLY_API_TOKEN`:** the GitHub repository secret created in STEP 38; gives the runner authority to deploy to your Fly org.

---

### F) First Deploy (Push to `main`)

1. From your IDE / GitHub Desktop: stage `fly.toml` + `.github/workflows/fly-deploy.yml`, commit, **push to `main`**.
2. Open `https://github.com/serkanbyx/video-streaming-platform/actions` → click the running **Fly Deploy** workflow.
3. Watch the build log. Stages you should see:
   - `actions/checkout@v4`
   - `setup-flyctl` → `flyctl v0.x.x installed`
   - `flyctl deploy --remote-only` → remote build kicks off
   - `npm ci` (full install on builder)
   - `tsc --build` for `shared`, then `server`
   - `npm prune --omit=dev`
   - Final image push to Fly's registry
   - `Updating existing machines in 'fragment-api' with rolling strategy`
   - `✔ Machine ... started`
4. Total runtime: **~3–5 minutes** (first build is slowest because no Docker layer cache).

If the workflow fails, the most common causes are:
- **App name mismatch** between `fly.toml` and the Dashboard → fix `fly.toml`, push again.
- **Volume not created** → return to step B.
- **`FLY_API_TOKEN` missing or revoked** → regenerate in Dashboard, update GitHub Secret.
- **Out-of-memory during `npm ci`** → bump VM memory in `fly.toml` (`memory = "1gb"`) for the build, scale back after.

---

### G) Verify the Live Backend (No CLI)

Once GitHub Actions reports green:

| Check | Where |
|---|---|
| Machine running | `Dashboard → fragment-api → Machines` → state = **started** |
| Volume mounted | `Dashboard → fragment-api → Volumes` → row shows **attached to machine** |
| Live logs | `Dashboard → fragment-api → Live Logs` → look for `[DB] connected` and the Express startup banner |
| Public health endpoint | `curl https://fragment-api.fly.dev/api/health` → returns `{ status: "ok", ... }` |
| FFmpeg present | `Dashboard → fragment-api → Console` → opens a browser shell into the machine; type `ffmpeg -version` |
| Disk free space | Same Console: `df -h /data` → should show ~3 GB free |

> **If `curl` fails with DNS error**, the app's hostname follows the **app name** you chose in step A. For `fragment-api-serkanbyx`, the URL is `https://fragment-api-serkanbyx.fly.dev`.

---

### H) Add the Admin Seed Workflow (`.github/workflows/fly-seed-admin.yml`)

`fly ssh console -C "node …seedAdmin.js"` is replaced by a one-off, manually-triggered GitHub Action.

Create `.github/workflows/fly-seed-admin.yml`:

```yaml
name: Seed Admin User

on:
  workflow_dispatch:

jobs:
  seed:
    name: Run admin seed inside the Fly machine
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Install flyctl
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Seed admin
        run: |
          flyctl ssh console \
            --app fragment-api \
            --command "node /app/server/dist/seed/seedAdmin.js"
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

> **App name:** if your app is `fragment-api-serkanbyx`, update both `--app` and the path remains `/app/server/dist/seed/seedAdmin.js` (the Docker workdir).

Commit + push. Then trigger it once:

1. GitHub → **Actions** tab → **Seed Admin User** → **Run workflow** → branch `main` → **Run**.
2. Watch the log → expect `[seed] admin upserted: admin@fragment.dev` (or "already exists" on subsequent runs — the script is idempotent).

> **Why a separate workflow, not part of `fly-deploy.yml`?** Seeding is a **one-time** operation. Wiring it into every deploy would re-run it on every push (fine because idempotent, but wastes time and clutters logs). `workflow_dispatch` keeps it intentional.

---

### I) Backend Operational Verification (End-to-End)

- [ ] `Dashboard → Machines` shows machine running, region matches `fly.toml`.
- [ ] `Dashboard → Volumes` shows `fragment_data` (3 GB) attached.
- [ ] `Dashboard → Live Logs` contains `[DB] connected` + Express startup banner.
- [ ] `Dashboard → Console` → `ffmpeg -version` prints version.
- [ ] `Dashboard → Console` → `df -h /data` shows ~3 GB free.
- [ ] `curl https://<app-name>.fly.dev/api/health` returns `{ status: "ok", ... }`.
- [ ] `POST /api/auth/login` with seeded admin credentials returns a JWT token.
- [ ] `Dashboard → Org → Billing` shows current usage = `$0`.

**Exit criteria for STEP 41:**
- Backend reachable at `https://<app-name>.fly.dev/api/health`.
- Admin user exists in the Atlas DB (verified by login).
- `git push origin main` triggers a deploy that completes green inside 5 minutes.
- Admin seed workflow ran at least once successfully.
- Net Fly.io bill remains `$0`.

**SECURITY:**
- Runtime secrets (`MONGO_URI`, `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, …) live **only** in Fly.io's encrypted secret store — never in GitHub, never in source.
- Only the deployment token (`FLY_API_TOKEN`) lives in GitHub Secrets — it can deploy but cannot decrypt other secrets.
- `force_https = true` redirects `http://` → `https://` at the Fly edge.
- `auto_stop_machines = false` keeps the machine always-on (no cold starts that would interrupt FFmpeg jobs mid-transcode).
- The persistent volume is encrypted at rest by Fly.io.
- The deploy workflow uses `--remote-only`: source code is shipped to Fly's builder, not stored on GitHub's runner disk after the run.
- `concurrency: fly-deploy` prevents racing deploys that could deploy mismatched commits to the same machine.
- Multi-stage Docker build (STEP 40) means the runtime image has no TypeScript compiler and no devDependencies — minimal attack surface.
- If `FLY_API_TOKEN` leaks: Dashboard → User Settings → Access Tokens → **Revoke**. Generate a new one, update the GitHub secret, no other rotation needed.

---

## STEP 42 — Frontend on Netlify & Maintenance Workflow

### A) Push Repo to GitHub

(The user does this manually via GitHub Desktop per their workflow.)

Confirm `client/`, `server/`, and `shared/` directories are all pushed, and `.env` files are NOT committed.

### B) Create the Netlify Site

1. **Add new site → Import from Git → choose GitHub → select repo**.
2. **Build settings:**
   - **Base directory:** *(leave blank — Netlify must see the workspace root to install `@fragment/shared`)*
   - **Build command:** `npm install && npm run build:shared && npm run build --workspace=fragment-client`
   - **Publish directory:** `client/dist`
3. **Environment variables:**
   - `VITE_API_URL` = `https://fragment-api.fly.dev`
   - `VITE_MAX_UPLOAD_SIZE_MB` = `100`
   - `VITE_MAX_VIDEO_DURATION_SECONDS` = `120`
4. **Deploy.**

> **Why workspace-root build?** The client imports from `@fragment/shared` which only resolves when `npm install` runs at the workspace root. If you set base directory to `client`, npm only installs client-specific deps and `@shared/*` imports fail.

### C) SPA Fallback (Critical)

Create `client/public/_redirects` with one line:

```
/*  /index.html  200
```

### D) Rename Site (Optional)

To get a clean URL like `https://fragment.netlify.app`: dashboard → site → **Site settings** → **Change site name**.

### E) Update CORS If URL Changed

```bash
fly secrets set CLIENT_ORIGIN="https://<your-actual-name>.netlify.app"
```

### F) Functional Verification (End-to-End)

Open the live Netlify URL in a fresh browser (or incognito window) and tick each:

- [ ] Register new viewer → success.
- [ ] Login → token stored, redirect to home.
- [ ] Become creator → role updated.
- [ ] Upload a short MP4 → progress bar fills → status transitions pending → processing → ready.
- [ ] HLS playback works on detail page.
- [ ] View counter increments (and dedupes on reload).
- [ ] Like / dislike toggles persist across reloads.
- [ ] Comment + reply + edit + delete flow.
- [ ] Subscribe / unsubscribe; subscription feed populates.
- [ ] Admin login → dashboard stats render.
- [ ] Admin role change, ban, delete flows respect self-protection and last-admin protection.
- [ ] Preferences (theme, density, scanlines, animations) apply instantly and persist.

### G) Security Verification (Live)

- [ ] Hit auth endpoint 11 times in 15 min from same IP → 11th request returns 429.
- [ ] Send a request from an unauthorized origin via curl with `Origin: https://evil.com` → CORS rejects.
- [ ] Trigger a bogus error → response has no stack trace, no internal field names.
- [ ] `curl -I https://fragment-api.fly.dev/api/health` → helmet headers present (`X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`), no `X-Powered-By`. Response also includes `X-Request-Id` and `RateLimit-*` headers.
- [ ] POST `{ "email": { "$gt": "" }, "password": { "$gt": "" } }` to login → request body sanitized, returns 422 (Zod validator) or 401, NOT 500.
- [ ] POST a comment with body `<script>alert(1)</script>` → stored escaped, rendered as text.
- [ ] Register with `{ "username":"x","email":"y@z.com","password":"abcdef12","role":"admin" }` → user created with `role: viewer` (Zod schema doesn't include `role` field — extra props ignored).
- [ ] `GET /api/admin/users` without admin token → 401 / 403.
- [ ] Try uploading a `.exe` renamed `.mp4` with `Content-Type: image/png` → multer rejects (MIME whitelist).
- [ ] Try uploading a file larger than `MAX_UPLOAD_SIZE_MB` → rejected by multer size limit.
- [ ] Try `GET /api/stream/../../../../etc/passwd` → 404 (path traversal blocked).
- [ ] Inspect a `failed` video as a non-author non-admin → `processingError` field is null in the response.

### H) Day-to-Day Maintenance Workflow

| Task | Command |
|---|---|
| Deploy new backend code | `fly deploy` (from repo root) |
| Tail live backend logs | `fly logs` |
| Filter logs by request ID | `fly logs \| grep <requestId>` |
| SSH into running machine | `fly ssh console` |
| Restart backend | `fly apps restart fragment-api` |
| Check disk usage | `fly ssh console -C "df -h /data"` |
| Manually clean old failed uploads | `fly ssh console -C "find /data/uploads/raw -mtime +1 -delete"` |
| Trigger admin cleanup endpoint | `curl -X POST -H "Authorization: Bearer <admin-token>" https://fragment-api.fly.dev/api/admin/maintenance/cleanup` |
| Update a Fly.io secret | `fly secrets set KEY=value` (auto-redeploys) |
| View costs | `fly orgs show personal` |
| Redeploy frontend | `git push` (Netlify auto-builds) |
| Re-seed demo data | See STEP 37 section H |
| Local typecheck across workspaces | `npm run typecheck` (from root) |

### I) Post-Launch Sharing

1. **Screenshot the home page.**
2. **Verify OG previews** (LinkedIn Post Inspector, Twitter Card Validator).
3. **Add to portfolio README:** include the live URL, a 30-second screencast, the GitHub repo link, the architecture diagram, **and a "TypeScript-everywhere with shared schemas" callout** — this is a strong technical signal for senior reviewers.
4. **Monitor first week:** `fly logs` once a day, watch disk usage, watch billing dashboard.

**Exit criteria for STEP 42:**
- Live URL works end-to-end.
- All functional + security checks pass.
- OG preview renders correctly when URL is shared.
- Maintenance workflow understood.

---

**END OF BUILD GUIDE — FRAGMENT (TypeScript Edition).**

Once every step is complete, you have a brutalist, FFmpeg-powered video streaming platform with HLS playback, role-based access, **end-to-end TypeScript with shared validation schemas**, and a security posture suitable for a production MVP — deployed to Fly.io + Netlify, with $0 monthly bill, full structured logging, and a documented future migration path to Backblaze B2 + Cloudflare CDN (see [`docs/MIGRATION-TO-B2.md`](./docs/MIGRATION-TO-B2.md)).
