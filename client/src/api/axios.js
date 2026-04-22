import axios from 'axios';
import toast from 'react-hot-toast';

const TOKEN_KEY = 'fragment:token';
const RATE_LIMIT_THRESHOLD = 4;
const RATE_LIMIT_WARN_COOLDOWN_MS = 5000;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
});

// Reads draft-7 `RateLimit-*` headers and warns the user before they get
// throttled. Throttled to once every 5s to avoid toast spam.
let lastWarnAt = 0;
const surfaceRateLimitWarning = (headers) => {
  const remaining = Number(headers['ratelimit-remaining']);
  if (!Number.isFinite(remaining) || remaining > RATE_LIMIT_THRESHOLD) return;
  if (Date.now() - lastWarnAt < RATE_LIMIT_WARN_COOLDOWN_MS) return;
  lastWarnAt = Date.now();
  toast(`// ${remaining} REQUESTS LEFT // SLOW DOWN`, { icon: '!!' });
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    surfaceRateLimitWarning(response.headers);
    return response;
  },
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    if (status === 429) {
      const retryAfter = Number(error.response.headers['retry-after']) || 60;
      toast.error(`// THROTTLED // RETRY IN ${retryAfter}s`);
    }

    if (error.response?.data?.requestId) {
      error.requestId = error.response.data.requestId;
    }

    return Promise.reject(error);
  }
);

export default api;
