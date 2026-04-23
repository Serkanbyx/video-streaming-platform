# Migration Guide — Fly.io Volume → Backblaze B2 + Cloudflare CDN

> **Status:** Future migration plan. **Not** part of the v1 build.
> **When to execute:** When the Fly.io 3 GB persistent volume becomes a bottleneck (more than ~30 demo videos, or you start sharing the platform with real users), OR when bandwidth on Fly.io approaches the 100 GB/month free allowance, OR when global latency for non-EU users becomes a complaint.
> **Estimated effort:** 1–2 days of focused work for an experienced developer.
> **Estimated cost after migration:** Still **$0/month** for portfolio-scale traffic, scales to ~$5/month at 1 TB stored + 10 TB egress.

---

## Why Migrate?

The v1 architecture stores HLS output on Fly.io's persistent volume and serves it via `express.static`. This works great for a portfolio MVP but has three hard limits:

| Limit | v1 (Fly.io Volume) | After Migration (B2 + CF) |
|---|---|---|
| Storage | 3 GB free, $0.15/GB/mo above | 10 GB free, $6/TB/mo above |
| Bandwidth | 100 GB/mo free, $0.02/GB above | **Unlimited free** via Cloudflare Bandwidth Alliance |
| Global latency | Single region (e.g., Frankfurt) | **300+ Cloudflare edge POPs** |
| Origin CPU during streaming | High (every segment hits Express) | **Near-zero** (CDN edge serves 95%+ of segments) |
| Server resilience | If VM dies, videos are inaccessible | Videos served independently from VM |

The migration also separates **concerns**: compute (Fly.io), storage (B2), and delivery (Cloudflare). This is the standard production architecture used by professional video platforms.

---

## Architecture Diagram

### Before (v1)

```
[ Browser ]
    │ upload .mp4
    ▼
[ Fly.io VM (Express) ]
    │ FFmpeg HLS transcode
    ▼
[ Fly.io Persistent Volume /data/uploads/processed/<videoId>/ ]
    │
    ▲ express.static reads from disk
    │ stream segments
[ Browser playback ]
```

### After (B2 + Cloudflare)

```
[ Browser ]
    │ upload .mp4
    ▼
[ Fly.io VM (Express) ]
    │ FFmpeg HLS transcode (output to /tmp/<videoId>/)
    ▼
[ Backblaze B2 bucket "fragment-hls" ]
    │ folder structure: <videoId>/{index.m3u8, *.ts, thumbnail.jpg}
    ▼
[ Cloudflare CDN edge (200+ POPs) ]  ← Bandwidth Alliance, free egress
    │
    ▼
[ Browser playback at https://cdn.fragment.app/<videoId>/index.m3u8 ]
```

The Fly.io VM no longer touches video files during playback — it only handles the upload + transcode workflow and the API. After upload, the temp folder is uploaded to B2 then deleted from the VM, reclaiming volume space.

---

## Phase 1 — Backblaze B2 Setup

### 1.1 Create a Backblaze Account

1. Sign up at `https://www.backblaze.com/sign-up/cloud-storage`.
2. Email verification — no credit card required for the free 10 GB.
3. Navigate to **B2 Cloud Storage** → **Buckets**.

### 1.2 Create the Bucket

- Bucket name: `fragment-hls` (must be globally unique — try `fragment-hls-<yourname>` if taken)
- Files in Bucket: **Public** (necessary so Cloudflare can fetch without auth — see security note below)
- Default Encryption: leave at default (B2 managed keys)
- Object Lock: disabled

### 1.3 Configure Bucket Settings

After creation, click the bucket → **Bucket Settings**:

- **Lifecycle Settings:** add a rule "Keep all versions of the file: 1 day after delete" (auto-cleanup of overwrites)
- **CORS Rules:** add a rule:
  ```json
  [{
    "corsRuleName": "fragmentCors",
    "allowedOrigins": ["https://fragment.netlify.app"],
    "allowedHeaders": ["range"],
    "allowedOperations": ["s3_head", "s3_get"],
    "exposeHeaders": ["content-length", "content-range", "accept-ranges"],
    "maxAgeSeconds": 3600
  }]
  ```
  This lets browsers fetch HLS segments via fetch/XHR with Range requests (HLS.js requires this).

### 1.4 Generate Application Keys

Go to **Application Keys** → **Add a New Application Key**:

- Name of Key: `fragment-server-write`
- Allow access to Bucket(s): `fragment-hls` only (principle of least privilege)
- Type of Access: Read and Write
- Save → copy the `keyID` and `applicationKey` immediately (shown only once)

You'll add these to Fly.io secrets in Phase 3.

### 1.5 Note Your Endpoint URL

In the bucket details page, find the **S3 Endpoint** — looks like:

```
https://s3.us-west-004.backblazeb2.com
```

The `us-west-004` (or whatever) is your bucket's region. Save this for the SDK config.

---

## Phase 2 — Cloudflare CDN Setup

### 2.1 Create a Cloudflare Account

1. Sign up at `https://dash.cloudflare.com/sign-up`.
2. Add a domain — for the migration to work optimally, you need a real domain (e.g., `fragment.app`). You can buy one for ~$10/year on Cloudflare Registrar (no markup).

> **Without a custom domain:** You can still use Cloudflare's reverse proxy via a Workers route, but the Bandwidth Alliance free egress only kicks in when the request comes through the Cloudflare network. Custom domain is the simplest path.

### 2.2 Create a CNAME for the CDN Origin

In Cloudflare DNS settings for your domain:

| Type | Name | Target | Proxy status |
|---|---|---|---|
| CNAME | `cdn` | `f004.backblazeb2.com` (use YOUR endpoint hostname) | **Proxied (orange cloud)** |

The proxy MUST be enabled (orange cloud) — that's what activates the Bandwidth Alliance free egress.

### 2.3 Add a Page Rule for Caching

Cloudflare Page Rules → **Create Page Rule**:

- URL: `cdn.fragment.app/file/fragment-hls/*`
- Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 day

This caches HLS segments aggressively at the edge — once a segment is fetched from B2 once, it's served from Cloudflare for the next 30 days.

### 2.4 Verify Bandwidth Alliance

Send a test request:

```bash
curl -I https://cdn.fragment.app/file/fragment-hls/test.txt
```

Look for the response header:

```
cf-cache-status: HIT     (after second request)
cf-ray: <some-id>-FRA    (Frankfurt edge)
```

If you see `cf-cache-status` headers, traffic is flowing through Cloudflare → B2 egress is free.

---

## Phase 3 — Storage Abstraction Layer (Code Changes)

This is the only part of the v1 codebase that changes. The goal: introduce a single `storage.service.js` interface so the rest of the app doesn't care where files live.

### 3.1 Install AWS SDK (B2 is S3-compatible)

```bash
cd server
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
```

### 3.2 Create the Storage Interface

**`server/services/storage.service.js`:**

```js
// Public interface every storage adapter must implement:
// - uploadFolder(localDir, remotePrefix) → Promise<void>
// - getPublicUrl(remotePath) → string
// - deleteFolder(remotePrefix) → Promise<void>
// - getMetrics() → Promise<{ usedBytes, fileCount }>

import { LocalStorageAdapter } from './storage.local.js';
import { B2StorageAdapter } from './storage.b2.js';
import { env } from '../config/env.js';

const adapters = {
  local: LocalStorageAdapter,
  b2: B2StorageAdapter,
};

const Adapter = adapters[env.STORAGE_DRIVER];
if (!Adapter) throw new Error(`Unknown STORAGE_DRIVER: ${env.STORAGE_DRIVER}`);

export const storage = new Adapter();
```

### 3.3 Local Adapter (Existing Behavior)

**`server/services/storage.local.js`:**

```js
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';

export class LocalStorageAdapter {
  async uploadFolder(localDir, remotePrefix) {
    const target = path.join(env.UPLOAD_DIR_PROCESSED, remotePrefix);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    if (localDir !== target) {
      await fs.promises.cp(localDir, target, { recursive: true });
      await fs.promises.rm(localDir, { recursive: true, force: true });
    }
  }

  getPublicUrl(remotePath) {
    return `/api/stream/${remotePath}`;
  }

  async deleteFolder(remotePrefix) {
    const target = path.join(env.UPLOAD_DIR_PROCESSED, remotePrefix);
    await fs.promises.rm(target, { recursive: true, force: true });
  }

  async getMetrics() {
    // walk env.UPLOAD_DIR_PROCESSED, return total size + file count
    // (already implemented for the disk usage admin endpoint)
  }
}
```

### 3.4 B2 Adapter (New)

**`server/services/storage.b2.js`:**

```js
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { env } from '../config/env.js';

const s3 = new S3Client({
  endpoint: env.B2_ENDPOINT,
  region: env.B2_REGION,
  credentials: {
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APPLICATION_KEY,
  },
});

export class B2StorageAdapter {
  async uploadFolder(localDir, remotePrefix) {
    const files = await fs.promises.readdir(localDir);
    await Promise.all(files.map(async (filename) => {
      const localPath = path.join(localDir, filename);
      const Body = fs.createReadStream(localPath);
      const ContentType = mime.lookup(filename) || 'application/octet-stream';
      const upload = new Upload({
        client: s3,
        params: {
          Bucket: env.B2_BUCKET,
          Key: `${remotePrefix}/${filename}`,
          Body,
          ContentType,
          CacheControl: 'public, max-age=31536000, immutable',
        },
      });
      await upload.done();
    }));
    await fs.promises.rm(localDir, { recursive: true, force: true });
  }

  getPublicUrl(remotePath) {
    return `${env.CDN_BASE_URL}/${env.B2_BUCKET}/${remotePath}`;
  }

  async deleteFolder(remotePrefix) {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: env.B2_BUCKET,
      Prefix: `${remotePrefix}/`,
    }));
    if (!list.Contents?.length) return;
    await s3.send(new DeleteObjectsCommand({
      Bucket: env.B2_BUCKET,
      Delete: { Objects: list.Contents.map(({ Key }) => ({ Key })) },
    }));
  }

  async getMetrics() {
    // ListObjectsV2 with pagination, sum sizes
    // implementation similar to local adapter but reads from B2
  }
}
```

### 3.5 Refactor `processing.service.js`

Replace the direct file path manipulation with the storage interface:

```js
// BEFORE (v1):
const outputDir = path.join(env.UPLOAD_DIR_PROCESSED, videoDoc.videoId);
videoDoc.hlsPath = `processed/${videoDoc.videoId}/index.m3u8`;
videoDoc.thumbnailPath = `processed/${videoDoc.videoId}/thumbnail.jpg`;

// AFTER (v2):
const tempDir = path.join('/tmp/transcode', videoDoc.videoId);
// ... FFmpeg writes to tempDir ...
await storage.uploadFolder(tempDir, videoDoc.videoId);
videoDoc.hlsPath = storage.getPublicUrl(`${videoDoc.videoId}/index.m3u8`);
videoDoc.thumbnailPath = storage.getPublicUrl(`${videoDoc.videoId}/thumbnail.jpg`);
```

The `hlsPath` field now stores the **full public URL** instead of a relative path. Update the API serializer to return `hlsPath` as-is to the client (no prefix transformation needed).

### 3.6 Refactor `deleteVideo` Controller

```js
// BEFORE: fs.promises.rm(localFolder, ...)
// AFTER:
await storage.deleteFolder(video.videoId);
```

### 3.7 Refactor `stream.routes.js`

When `STORAGE_DRIVER === 'b2'`, the Express static route is no longer needed (CDN serves directly). Add a guard:

```js
if (env.STORAGE_DRIVER === 'local') {
  app.use('/api/stream', express.static(...));
}
```

### 3.8 Update `config/env.js`

Add new env vars (only required when `STORAGE_DRIVER === 'b2'`):

| Variable | Type | Required | Notes |
|---|---|---|---|
| `STORAGE_DRIVER` | string | yes | `local` or `b2` |
| `B2_ENDPOINT` | string | if b2 | e.g., `https://s3.us-west-004.backblazeb2.com` |
| `B2_REGION` | string | if b2 | e.g., `us-west-004` |
| `B2_KEY_ID` | string | if b2 | from Phase 1.4 |
| `B2_APPLICATION_KEY` | string | if b2 | from Phase 1.4 |
| `B2_BUCKET` | string | if b2 | e.g., `fragment-hls` |
| `CDN_BASE_URL` | string | if b2 | e.g., `https://cdn.fragment.app/file` |

### 3.9 Update Frontend Service

The video service no longer needs to prefix `hlsPath` with the API URL — it's already a full public CDN URL. Adjust:

```js
// BEFORE: const url = `${API_URL}${video.hlsPath}`;
// AFTER:  const url = video.hlsPath;
```

---

## Phase 4 — Migration of Existing Data

If you have already-uploaded videos on the Fly.io volume, they need to be moved to B2 before flipping the driver.

### One-Time Migration Script

**`server/scripts/migrateLocalToB2.js`:**

```js
// 1. Connect to MongoDB.
// 2. Fetch all Video docs where status === 'ready'.
// 3. For each:
//    a. Read the local folder /data/uploads/processed/<videoId>/
//    b. Upload to B2 via B2StorageAdapter.uploadFolder()
//    c. Update video.hlsPath and video.thumbnailPath to new CDN URLs.
//    d. Save.
//    e. (Optional) delete the local folder after successful B2 upload.
// 4. Print summary.
```

Run from inside the Fly.io container:

```bash
fly ssh console -C "node scripts/migrateLocalToB2.js"
```

### Cutover

1. Run the migration script with `STORAGE_DRIVER=local` still active (so script reads from local).
2. Verify all videos are accessible at their new CDN URLs (curl + browser test).
3. Set the new env var: `fly secrets set STORAGE_DRIVER=b2`.
4. Fly.io auto-redeploys with the new driver.
5. Test playback on the live site.
6. After 24 hours of confirmed working playback, delete the local folders to reclaim volume space:
   ```bash
   fly ssh console -C "rm -rf /data/uploads/processed/*"
   ```
7. Reduce the Fly.io volume size (or keep it for raw Multer uploads only).

---

## Phase 5 — Verification & Rollback

### Verify B2 + CDN Path

```bash
# Pick a video URL from the live site, e.g.:
curl -I https://cdn.fragment.app/file/fragment-hls/abc123/index.m3u8

# Expected headers:
# HTTP/2 200
# content-type: application/vnd.apple.mpegurl
# cf-cache-status: HIT       ← Cloudflare edge cache
# cf-ray: <id>-FRA           ← edge POP
```

### Verify Range Requests Work

HLS players use Range requests for `.ts` segments. Test:

```bash
curl -I -H "Range: bytes=0-1023" https://cdn.fragment.app/file/fragment-hls/abc123/000.ts
# Expected: HTTP/2 206 Partial Content
```

If this returns 200 instead of 206, the CORS rule in B2 is missing `range` in `allowedHeaders` (Phase 1.3).

### Rollback Procedure

If something breaks:

```bash
fly secrets set STORAGE_DRIVER=local
fly deploy
```

The local adapter takes over again. **Caveat:** any videos uploaded since the cutover were sent to B2 only — you'd need to download them from B2 back to the local volume for full rollback. So plan the cutover for a quiet period and monitor closely for the first hour.

---

## Cost Projection After Migration

Assuming portfolio-scale traffic (a few hundred recruiter visits per month, ~50 videos hosted):

| Service | Monthly Cost |
|---|---|
| Fly.io VM (compute only, no large volume) | $0 (under $5 free credit) |
| Fly.io volume (3 GB → can shrink to 1 GB for raw uploads only) | $0 |
| Backblaze B2 storage (50 videos × ~50MB = 2.5 GB) | $0 (under 10 GB free) |
| Backblaze B2 bandwidth (egress to Cloudflare) | **$0 (Bandwidth Alliance)** |
| Cloudflare CDN bandwidth | $0 (free plan, unlimited) |
| Cloudflare DNS + Page Rules | $0 (free plan) |
| Domain registration | ~$10/year (~$0.83/month) |
| **Total** | **~$1/month** (essentially $10/year for the domain) |

If you skip the custom domain and use a free subdomain via Cloudflare Workers routing, this drops to **$0/month**.

---

## Trade-offs Summary

| Aspect | v1 (Fly.io Volume) | v2 (B2 + Cloudflare) |
|---|---|---|
| Time to set up | 30 minutes | 1–2 days |
| Monthly cost (portfolio scale) | $0 | $0 (with custom domain: ~$1) |
| Storage ceiling | 3 GB free | 10 GB free, then $6/TB |
| Bandwidth ceiling | 100 GB free | Unlimited free |
| Global latency | Single region | Edge POPs worldwide |
| Operational complexity | Low | Medium (3 services to monitor) |
| Code changes needed | None | Storage abstraction + frontend URL handling |
| Mental model | Monolith | Distributed (compute / storage / delivery) |
| Resume / interview value | "I built and deployed a video platform" | "I architected a CDN-backed streaming platform with object storage and edge caching" |

---

## When NOT to Migrate

Don't migrate if:

- You have fewer than 30 videos and don't expect more.
- Your audience is single-region (e.g., only Turkey-based recruiters → Frankfurt VM is already fast).
- You don't have time to debug a multi-service architecture.
- You're not actively iterating on the project (don't introduce complexity to a "done" portfolio piece).

The v1 architecture is **completely valid** for portfolio purposes. This migration is a **portfolio enhancement**, not a necessity.

---

## Quick Reference — What Changes Where

| File | Change |
|---|---|
| `server/services/storage.service.js` | NEW — interface |
| `server/services/storage.local.js` | NEW — wraps existing local logic |
| `server/services/storage.b2.js` | NEW — B2/S3 SDK wrapper |
| `server/services/processing.service.js` | Replace direct fs paths with `storage.*` calls |
| `server/controllers/video.controller.js` | `deleteVideo` uses `storage.deleteFolder()` |
| `server/controllers/admin.controller.js` | Disk usage endpoint uses `storage.getMetrics()` |
| `server/routes/stream.routes.js` | Conditionally mount `express.static` only for `local` driver |
| `server/config/env.js` | Add B2 + CDN env vars |
| `server/scripts/migrateLocalToB2.js` | NEW — one-time data migration |
| `client/src/services/video.service.js` | Stop prefixing `hlsPath` with API URL |
| `fly.toml` | No change |
| `Dockerfile` | No change |

**Estimated lines of code changed:** ~150 (mostly new files)
**Estimated lines of code deleted:** ~10

---

## END OF MIGRATION GUIDE

Once executed, FRAGMENT graduates from a single-server portfolio piece to a CDN-backed distributed video platform — a much stronger story in technical interviews.
