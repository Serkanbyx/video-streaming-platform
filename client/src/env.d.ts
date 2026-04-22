/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_MAX_UPLOAD_SIZE_MB: string;
  readonly VITE_MAX_VIDEO_DURATION_SECONDS: string;
  readonly VITE_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
