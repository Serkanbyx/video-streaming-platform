import type { AxiosResponse } from 'axios';

import type { ApiSuccess } from '@shared/types/api.js';

/**
 * Backend handlers always wrap successful responses in `{ success, data }`.
 * `unwrap` extracts `data` while remaining tolerant of legacy/malformed
 * payloads that lack the wrapper.
 */
export const unwrap = <T>(response: AxiosResponse<ApiSuccess<T> | T>): T => {
  const body = response.data as ApiSuccess<T> | T;
  if (body && typeof body === 'object' && 'data' in (body as ApiSuccess<T>)) {
    return (body as ApiSuccess<T>).data;
  }
  return body as T;
};
