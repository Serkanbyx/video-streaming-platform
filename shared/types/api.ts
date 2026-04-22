export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  cached?: boolean;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{ field: string; msg: string }>;
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}
